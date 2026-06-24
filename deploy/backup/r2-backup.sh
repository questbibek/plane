#!/usr/bin/env bash
# Off-site Postgres backup to Cloudflare R2 (S3-compatible).
#
# Dumps the Plane database with pg_dump, gzips it, and uploads it to R2 under
# ${BACKUP_PREFIX}/. Modeled on the fork's file-DB backup system but adapted for
# Postgres:
#   * Schedule is enforced by *bucket contents*, not the in-process timer — we
#     only upload if the newest object is older than the interval (minus a
#     jitter tolerance). So a container/stack restart cannot spam backups.
#   * Retention is strictly count-based: keep the newest BACKUP_KEEP_COUNT,
#     delete the oldest only when over the cap. Pruning runs every cycle even
#     when the upload is skipped or fails, so we never drop below the cap.
#   * run-on-start fires once after a short delay to let the DB settle.
#
# Unlike the reference impl this stages the dump in a temp file before upload:
# streaming pg_dump straight to S3 risks publishing a truncated dump if pg_dump
# dies mid-pipe. A temp file lets us verify the dump succeeded before it counts
# as a backup.
set -uo pipefail

# ── Config (with defaults) ─────────────────────────────────────────────────
: "${BACKUP_ENABLED:=false}"
: "${BACKUP_INTERVAL_HOURS:=12}"
: "${BACKUP_KEEP_COUNT:=30}"
: "${BACKUP_RUN_ON_START:=true}"
: "${BACKUP_PREFIX:=planedbbackup}"
: "${BACKUP_JITTER_MINUTES:=30}"

# Database (shared with the app's .env)
: "${POSTGRES_HOST:=plane-db}"
: "${POSTGRES_PORT:=5432}"
: "${POSTGRES_USER:?POSTGRES_USER is required}"
: "${POSTGRES_DB:?POSTGRES_DB is required}"
: "${POSTGRES_PASSWORD:?POSTGRES_PASSWORD is required}"

# R2 / S3 (same credentials as the app's object storage)
: "${AWS_ACCESS_KEY_ID:?AWS_ACCESS_KEY_ID is required}"
: "${AWS_SECRET_ACCESS_KEY:?AWS_SECRET_ACCESS_KEY is required}"
: "${AWS_S3_ENDPOINT_URL:?AWS_S3_ENDPOINT_URL is required}"
: "${AWS_S3_BUCKET_NAME:?AWS_S3_BUCKET_NAME is required}"
: "${AWS_REGION:=auto}"

export PGPASSWORD="$POSTGRES_PASSWORD"
# aws-cli reads region from AWS_DEFAULT_REGION; R2 expects "auto".
export AWS_DEFAULT_REGION="$AWS_REGION"

readonly BUCKET="$AWS_S3_BUCKET_NAME"
readonly PREFIX="${BACKUP_PREFIX%/}"                 # strip any trailing slash
readonly INTERVAL_SECS=$(( BACKUP_INTERVAL_HOURS * 3600 ))
readonly JITTER_SECS=$(( BACKUP_JITTER_MINUTES * 60 ))
# Single source of truth for the aws-cli invocation against R2.
aws_s3() { aws --endpoint-url "$AWS_S3_ENDPOINT_URL" "$@"; }

log() { echo "[r2-backup] $(date -u +%FT%TZ) $*"; }

# Epoch (UTC) of the newest object under the prefix; empty if none exist.
newest_backup_epoch() {
  local lm
  lm=$(aws_s3 s3api list-objects-v2 --bucket "$BUCKET" --prefix "${PREFIX}/" \
        --query 'sort_by(Contents,&LastModified)[-1].LastModified' --output text 2>/dev/null)
  [ "$lm" = "None" ] || [ -z "$lm" ] && return 0
  date -u -d "$lm" +%s 2>/dev/null
}

# True (0) if a backup exists within the interval (minus jitter tolerance).
has_recent_backup() {
  local newest now age
  newest=$(newest_backup_epoch)
  [ -z "$newest" ] && return 1
  now=$(date -u +%s)
  age=$(( now - newest ))
  [ "$age" -lt $(( INTERVAL_SECS - JITTER_SECS )) ]
}

# Dump → gzip → verify → upload. Returns non-zero without uploading on failure.
do_backup() {
  local ts key tmp
  ts=$(date -u +%Y-%m-%dT%H-%M-%SZ)
  key="${PREFIX}/backup-${ts}.sql.gz"
  tmp=$(mktemp "/tmp/plane-backup.XXXXXX.sql.gz")

  log "dumping ${POSTGRES_DB}@${POSTGRES_HOST} -> s3://${BUCKET}/${key}"
  if ! pg_dump -h "$POSTGRES_HOST" -p "$POSTGRES_PORT" -U "$POSTGRES_USER" \
        -d "$POSTGRES_DB" --no-owner --no-privileges -Fp | gzip > "$tmp"; then
    log "ERROR: pg_dump failed; not uploading"
    rm -f "$tmp"
    return 1
  fi

  if ! aws_s3 s3 cp "$tmp" "s3://${BUCKET}/${key}" >/dev/null; then
    log "ERROR: upload failed for ${key}"
    rm -f "$tmp"
    return 1
  fi

  log "upload complete: ${key} ($(du -h "$tmp" | cut -f1))"
  rm -f "$tmp"
}

# Delete everything except the newest BACKUP_KEEP_COUNT objects under the prefix.
prune() {
  local keys
  keys=$(aws_s3 s3api list-objects-v2 --bucket "$BUCKET" --prefix "${PREFIX}/" \
          --query "sort_by(Contents,&LastModified)[:-${BACKUP_KEEP_COUNT}].Key" \
          --output text 2>/dev/null)
  if [ -z "$keys" ] || [ "$keys" = "None" ]; then
    log "prune: within the ${BACKUP_KEEP_COUNT}-backup cap, nothing to remove"
    return 0
  fi
  for k in $keys; do
    log "prune: deleting ${k}"
    aws_s3 s3 rm "s3://${BUCKET}/${k}" >/dev/null || log "prune: failed to delete ${k}"
  done
}

run_once() {
  if has_recent_backup; then
    log "a backup already exists within the last ${BACKUP_INTERVAL_HOURS}h; skipping upload"
  else
    do_backup || log "backup cycle failed (see above)"
  fi
  # Always prune, even when the upload was skipped or failed — strictly count-based.
  prune
}

main() {
  if [ "$BACKUP_ENABLED" != "true" ]; then
    log "BACKUP_ENABLED is not 'true'; backups disabled. Idling."
    while true; do sleep 3600; done
  fi

  log "enabled: interval=${BACKUP_INTERVAL_HOURS}h keep=${BACKUP_KEEP_COUNT} prefix=${PREFIX}/ bucket=${BUCKET}"

  if [ "$BACKUP_RUN_ON_START" = "true" ]; then
    sleep 60                       # let the DB settle after a stack restart
    run_once
  fi

  while true; do
    sleep "$INTERVAL_SECS"
    run_once
  done
}

main
