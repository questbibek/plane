# Vrit Tech Branding (Plane fork)

This fork layers **Vrit Tech** branding on top of upstream Plane so that pulling
upstream updates never clobbers the branding, and if a merge ever touches a
branded line you can re-apply it in seconds.

> Display name is **"Vrit Tech"** on visible surfaces (titles, tab name, auth
> screens, PWA metadata). Deep i18n strings and code symbols stay "Plane" — we
> rebrand the *visible* name + logo only, so the merge surface stays small.

> **Status: WIRED (web/admin/space).** Assets are distributed, the brand
> component exists, every hook below is applied, and `scripts/check-branding.sh`
> reports "Branding intact." The upstream-sync procedure that keeps it that way
> lives in [MERGE_CHECKLIST.md](MERGE_CHECKLIST.md).

## Design: isolate, don't scatter

Plane has **three** branded frontends (`apps/web`, `apps/admin`, `apps/space`).
All branding *logic* lives in **new files upstream doesn't have**, so they can
never conflict on a merge:

| New file | Purpose |
|----------|---------|
| `apps/{web,admin,space}/public/vrit-white.png` | Wordmark for dark surfaces |
| `apps/{web,admin,space}/public/vrit-blue.png` | Wordmark for the light theme |
| `apps/{web,admin,space}/public/vrit-fav.png` | Favicon |
| `apps/web/core/components/branding/VritBrand.tsx` | `<VritLogo>` + `<VritPoweredBy>` (theme-aware) |

Master copies of the three PNGs live in [brand-assets/](brand-assets/);
re-distribute per frontend with:

```bash
for app in web admin space; do cp brand-assets/vrit-*.png apps/$app/public/; done
```

Upstream-owned files get only a **single fenced hook**, marked for grep so a
conflict is obvious and a script can verify it survived:

```tsx
/* >>> VRIT BRANDING (see BRANDING.md) */
...one or two lines...
/* <<< VRIT BRANDING */
```

## The brand component

`apps/web/core/components/branding/VritBrand.tsx` exports:

```tsx
// White wordmark reads on dark surfaces; blue reads on the light theme,
// auto-swapped via next-themes useTheme().resolvedTheme.
export function VritLogo({ className }: { className?: string })       // <img> swap by theme
export function VritPoweredBy({ className }: { className?: string })  // "Powered by" + logo, links VRIT_URL
export const VRIT_URL = "https://vrittechnologies.com";
```

## The exact touch points

The only edits inside upstream files. If a merge conflict involves one, re-apply
exactly the fenced block. **Confirm each path before editing — Plane's tree
moves; grep if it has shifted.**

### 1. Auth / login wordmark  ✅
- [x] `apps/web/core/components/auth-screens/header.tsx`
  Real login wordmark was `<PlaneLockup>` from `@plane/propel/icons`. Replaced
  with `<VritLogo className="h-5 w-auto" />` (fenced import + usage); page title
  suffix `" - Plane"` → `" - Vrit Tech"`.

### 2. Auth footer (customer-logo strip)  ✅
- [x] `apps/web/core/components/auth-screens/footer.tsx`
  Upstream rendered "Join 10,000+ teams building with Plane" + Zerodha/Sony/
  Dolby/Accenture logos (misleading on a Vrit deploy). Whole footer replaced
  with `<VritPoweredBy />`. Revert this file to restore upstream.

### 3. Auth subheaders  ✅
- [x] `apps/web/core/components/account/auth-forms/auth-header.tsx`
  "Welcome back to Plane." / "Create your Plane account." → "… Vrit Tech …"
  (trailing `/* VRIT BRANDING */`).

### 4. Favicons (one per frontend)  ✅
- [x] `apps/web/app/root.tsx` (links array) **and** `apps/web/app/layout.tsx` (`<head>`)
- [x] `apps/admin/app/root.tsx`
- [x] `apps/space/app/root.tsx`
  Fenced `/vrit-fav.png` entries added **first** in each links array so they win:
  ```tsx
  /* >>> VRIT BRANDING (see BRANDING.md) */
  { rel: "icon", type: "image/png", href: "/vrit-fav.png" },
  { rel: "apple-touch-icon", href: "/vrit-fav.png" },
  /* <<< VRIT BRANDING */
  ```

### 5. Name surfaces  ✅
- [x] `packages/constants/src/metadata.ts` — `SITE_NAME`/`SITE_TITLE`/
  `TWITTER_USER_NAME`/`SPACE_SITE_*` → "Vrit Tech" (fenced).
- [x] `apps/web/app/root.tsx` + `layout.tsx` — `APP_TITLE`/title/og:title,
  `application-name`, og/twitter `image:alt` → "Vrit Tech".
- [x] `apps/admin/app/root.tsx`, `apps/space/app/root.tsx` — `APP_TITLE`
  (+ space `APP_DESCRIPTION`) → "Vrit Tech".

### 6. Intentionally skipped
- [ ] `logo-spinner.tsx`: left as Plane's animated GIF (optional, low value).
- [ ] Sidebar: Plane's sidebar top is the **workspace switcher** (shows the
      workspace's own logo), not a product-brand slot — no clean place for a
      `<VritLogo>`. Revisit if a brand header is desired.

## Verifying

`scripts/check-branding.sh` checks every asset + hook across all three frontends
and exits non-zero with the exact missing item. Run it after every upstream sync
(it is gate (b) in [MERGE_CHECKLIST.md](MERGE_CHECKLIST.md)):

```bash
./scripts/check-branding.sh   # → "Branding intact."
```

## Notes

- **Company URL**: "Powered by" links to `https://vrittechnologies.com`; visible
  short sign is "Vrit Tech".
- **Theme behavior**: logo auto-swaps — blue on light, white on dark.
- **Three frontends**: `admin` and `space` each have their own `public/` and
  favicon. The verifier checks all three.
- **Favicon contrast**: `vrit-fav.png` is a white mark; swap a higher-contrast
  icon (same filename, no code change) if it's faint on light browser tabs.
