# Tiny sidecar image for off-site Postgres backups to Cloudflare R2.
# Bundles the Postgres 15 client (pg_dump, to match the plane-db server) and the
# AWS CLI (S3-compatible upload to R2) — the two tools the backup loop needs.
FROM alpine:3.20

RUN apk add --no-cache \
      bash \
      coreutils \
      ca-certificates \
      gzip \
      postgresql15-client \
      aws-cli

COPY r2-backup.sh /usr/local/bin/r2-backup.sh
RUN chmod +x /usr/local/bin/r2-backup.sh

ENTRYPOINT ["/usr/local/bin/r2-backup.sh"]
