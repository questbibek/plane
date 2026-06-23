# Deploy — Vrit Tech → projects.vrittechnologies.com

SSH-based CI/CD, GitHub-only. On push to `vrit`,
[`.github/workflows/deploy-vrit.yml`](../.github/workflows/deploy-vrit.yml)
builds the 6 app images, pushes them to **GHCR**, then SSHes into the VPS and
runs `docker compose pull → migrate → up -d`.

```
push vrit ──▶ GitHub Actions ──▶ build 6 images ──▶ ghcr.io/<owner>/plane-*
                                                          │
                          SSH root@5.223.91.163 ◀─────────┘
                          docker compose -f docker-compose.vrit.yml
                          pull → run migrator → up -d
```

## GitHub config (one-time)

**Secrets** — `Settings → Secrets and variables → Actions → Secrets`:

| Secret | Value |
|---|---|
| `SSH_HOST` | `5.223.91.163` |
| `SSH_USER` | `root` |
| `SSH_PRIVATE_KEY` | private key of the deploy keypair (below) |
| `SSH_PORT` | `22` (only if non-default) |

No registry secret is needed: pushing to GHCR uses the built-in `GITHUB_TOKEN`.

**Variables** (optional — sensible defaults baked in):

| Variable | Default | |
|---|---|---|
| `REGISTRY` | `ghcr.io` | |
| `IMAGE_PREFIX` | repo owner | your GHCR namespace, lowercase |
| `DEPLOY_PATH` | `/opt/plane` | compose dir on the VPS |

### Deploy SSH key

```bash
ssh-keygen -t ed25519 -f deploy_key -N "" -C "github-actions-plane"
ssh root@5.223.91.163 'mkdir -p ~/.ssh && cat >> ~/.ssh/authorized_keys' < deploy_key.pub
# paste the full contents of ./deploy_key into the SSH_PRIVATE_KEY secret, then:
rm deploy_key deploy_key.pub
```

## VPS config (one-time)

The box already runs the stock `makeplane/plane-*` stack. Replace it with the
Vrit pull-based stack:

```bash
mkdir -p /opt/plane && cd /opt/plane
# copy these two files from the repo's deploy/ dir to the VPS:
#   docker-compose.vrit.yml   .env.example → .env
nano .env            # fill every CHANGE_ME; keep any existing passwords you want
chmod 600 .env
```

> **Storage is external (Cloudflare R2)** — uploaded files live in the R2 bucket,
> not a local volume. Only the DB lives on the box (`pgdata`). For greenfield
> (per the plan): bring the old stock stack down (`docker compose down`) and the
> new one up. To preserve an existing DB, run this compose from the **same project
> dir/name** as the old one so the `pgdata` volume is reused.
>
> Set the R2 block in `.env` (`USE_MINIO=0`, `AWS_REGION=auto`, `AWS_S3_ENDPOINT_URL`
> with **no** bucket suffix, `AWS_S3_BUCKET_NAME`, the R2 keys) and
> `PROXY_BUCKET_ROUTE=__minio_disabled__`. The bucket's CORS must allow the site origin.

### GHCR pull auth on the VPS

CI logs in with a job-scoped token for each deploy, so normal pushes "just work".
For the VPS to re-pull after a **reboot**, do one of:
- make the GHCR packages **public** (simplest — no creds on the box), or
- `docker login ghcr.io -u <user> -p <classic PAT with read:packages>` once on the VPS.

## DNS

`projects.vrittechnologies.com` → **A record** → `5.223.91.163`.
Caddy issues the Let's Encrypt cert automatically from `SITE_ADDRESS` + `CERT_EMAIL`.

## First deploy

Push to `vrit` (or run the workflow manually via **Actions → Build & Deploy → Run
workflow**). Then verify on the box:

```bash
cd /opt/plane && docker compose -f docker-compose.vrit.yml ps
docker compose -f docker-compose.vrit.yml logs -f api      # migrations clean, no fatal
```

- [ ] `https://projects.vrittechnologies.com` loads with Vrit branding on login
- [ ] `/god-mode` (admin) and `/spaces` (space) render
- [ ] sign-up works; custom-fields feature works end to end

## Rollback

```bash
cd /opt/plane
export APP_RELEASE=<previous-good-sha>      # immutable per-commit tag
docker compose -f docker-compose.vrit.yml pull && docker compose -f docker-compose.vrit.yml up -d
```
Postgres data is untouched by image swaps. Restore from a dump only if a
migration corrupted data (additive migrations shouldn't).
