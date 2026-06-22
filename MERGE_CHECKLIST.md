# Upstream Sync & Merge Checklist (Vrit fork of Plane)

How we pull upstream Plane forever **without losing our customizations**. Every
`upstream/preview → preview → vrit` sync MUST pass every gate below before you
push `vrit` (pushing `vrit` triggers the build + deploy — see
[deploy/README.md](deploy/README.md)).

## Branch model

| Branch | Role |
|--------|------|
| **`preview`** | Pristine mirror of `makeplane/plane`. **No Vrit commit ever lands here.** Stays fast-forwardable forever — it's the tripwire. |
| **`vrit`** | Our deploy branch: branding + custom fields + deploy pipeline. This is what builds & deploys. |

Flow: `upstream/preview → preview (fast-forward) → merge preview into vrit
(resolve our fenced conflicts) → push vrit → CI builds & deploys`.

## What must survive every sync ("our customizations")

1. **Branding** — `VritBrand.tsx`, the 9 PNGs (3 per frontend), and the fenced
   `VRIT BRANDING` hooks. Full list in [BRANDING.md](BRANDING.md); enforced by
   `scripts/check-branding.sh`.
2. **Custom fields feature** — backend (`apps/api/.../custom_field.py` ×8 +
   migration `0122` + the `__init__.py` exports) and frontend (`@plane/types`
   `custom-fields.ts`, the store/service/hook, the `custom-fields/` components,
   the settings page + route, the issue-sidebar hook, the project-settings nav).
3. **Deploy pipeline** — `.github/workflows/deploy-vrit.yml`, `deploy/`. All new
   files, so they never conflict.

---

## 0. Pre-flight
- [ ] DB backup exists (Postgres dump of the live instance).
- [ ] `git status` clean on `vrit`.
- [ ] `upstream` remote exists (`git remote -v` shows `makeplane/plane`). If not:
      `git remote add upstream https://github.com/makeplane/plane.git`

## 1. Sync the mirror (`preview` — never carries Vrit commits)
```bash
git fetch upstream && git checkout preview && git merge --ff-only upstream/preview && git push origin preview
git fetch origin && git checkout vrit
```
> If `--ff-only` fails, a Vrit commit leaked onto `preview`. Fix that — don't force.

## 2. Start the merge
```bash
git merge preview                       # do NOT commit yet
git diff --name-only --diff-filter=U    # list conflicts
```

## 3. Resolve conflicts with intent

| If the conflict is… | Action |
|---|---|
| A feature/fix upstream now ships (the actual product) | **Take upstream**; delete any of our now-redundant code + orphaned imports/state. |
| One of our **unique** additions (branding, custom fields, deploy) | **Keep ours**, merged *with* upstream's surrounding changes — don't clobber new upstream code. |
| A fenced `VRIT BRANDING` block | Keep **both** upstream's change and the fenced block. |
| `package.json` / workspace manifests | Keep our added deps **and** take upstream's version bumps. |
| `pnpm-lock.yaml` | Don't hand-merge: `git checkout --theirs -- pnpm-lock.yaml && pnpm install --lockfile-only`. |
| Django migrations | Never edit upstream migrations; if our `0122` collides, **renumber ours** to follow upstream's latest and fix its `dependencies`. |

> After dropping a redundant patch, grep for leftovers it referenced and remove
> them from **all** files (frontends + `apps/api` + compose/env).

## 4. Validation gates — ALL must pass before committing

```bash
# (a) no conflict markers anywhere (ignore .md)
git grep -n "^<<<<<<<\|^>>>>>>>" | grep -v "\.md:" ; echo "↑ must be empty"

# (b) branding intact — every asset + hook across web/admin/space
./scripts/check-branding.sh                      # → "Branding intact."

# (c) custom-fields feature intact
[ -f packages/types/src/custom-fields.ts ] && echo "ok types" || echo "MISSING types"
[ -f apps/web/core/store/custom-field.store.ts ] && echo "ok store" || echo "MISSING store"
ls apps/api/plane/db/migrations/0*_customfield_customfieldvalue.py >/dev/null 2>&1 \
  && echo "ok migration" || echo "MISSING migration"
git grep -q "CustomFieldValuesSection" apps/web/core/components/issues/issue-detail/sidebar.tsx \
  && echo "ok issue-sidebar hook" || echo "MISSING issue-sidebar hook"

# (d) backend checks (run inside the apps/api Python env)
cd apps/api && python manage.py makemigrations --check --dry-run   # no missing migrations
cd apps/api && python manage.py check
# env-free sanity (no DB/settings): byte-compile what we touched
python -m py_compile $(git diff --name-only preview...vrit -- 'apps/api/**/*.py')

# (e) frontend typecheck — our merge must add ZERO errors vs pristine upstream
pnpm --filter web check:types            # validated clean on vrit (react-router typegen && tsc --noEmit)
pnpm --filter @plane/types check:types
# or sweep all: turbo run check:types

# (f) real build — the type-check can't catch this
docker compose -f docker-compose.yml build      # full source build; MUST exit 0
```

## 5. Smoke test the built stack
```bash
docker compose -f docker-compose-local.yml up -d   # throwaway volumes
```
- [ ] Migrations completed; `api` logs clean (no `fatal`/crash)
- [ ] Sign-in / sign-up works; instance loads
- [ ] Vrit branding renders on the login page **and** on `admin` (`/god-mode`) + `space` (`/spaces`)
- [ ] Custom fields: create a field in project settings, set a value on a work item — persists

## 6. Commit & deploy
```bash
git commit --no-edit          # commit the merge
git push origin vrit          # → triggers .github/workflows/deploy-vrit.yml
```
The pipeline builds the 6 app images → pushes to GHCR → SSHes into the VPS and
runs `docker compose -f docker-compose.vrit.yml pull → migrator → up -d`. Full
setup + secrets/variables in [deploy/README.md](deploy/README.md).
- [ ] CI: **build ✅ + deploy ✅** (Actions tab)
- [ ] On the server: `docker compose -f docker-compose.vrit.yml ps` all healthy;
      `logs api` clean; site loads with Vrit branding.

## Rollback (if a deploy goes bad)
```bash
cd /opt/plane
export APP_RELEASE=<previous-good-sha>      # immutable per-commit GHCR tag
docker compose -f docker-compose.vrit.yml pull && docker compose -f docker-compose.vrit.yml up -d
```
Postgres data is untouched by image swaps. To revert source: `git revert -m 1
<merge-commit>` on `vrit` and push. Restore the DB from a dump only if a
migration corrupted data (additive migrations shouldn't).
