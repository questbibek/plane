#!/usr/bin/env bash
#
# Vrit Tech branding verifier for the Plane fork.
# Run after every upstream sync (see MERGE_CHECKLIST.md). Exits non-zero and
# prints exactly what is missing so a dropped hook is easy to re-apply.
#
# Usage:  ./scripts/check-branding.sh
#
set -u

# cd to repo root (this script lives in scripts/)
cd "$(dirname "$0")/.." || exit 2

fail=0
ok()   { printf '  \033[32mok\033[0m   %s\n' "$1"; }
miss() { printf '  \033[31mMISS\033[0m %s\n' "$1"; fail=1; }

# A hook exists if the file is present AND contains the given marker string.
check_contains() { # <file> <needle> <label>
  if [ ! -f "$1" ]; then miss "$3 — file not found: $1"; return; fi
  if grep -qF -- "$2" "$1"; then ok "$3"; else miss "$3 — marker '$2' not in $1"; fi
}

echo "== Assets (per frontend) =="
for app in web admin space; do
  for f in vrit-white.png vrit-blue.png vrit-fav.png; do
    p="apps/$app/public/$f"
    [ -f "$p" ] && ok "$p" || miss "$p"
  done
done

echo "== Brand component =="
check_contains "apps/web/core/components/branding/VritBrand.tsx" "VritLogo"      "VritBrand exports VritLogo"
check_contains "apps/web/core/components/branding/VritBrand.tsx" "VritPoweredBy" "VritBrand exports VritPoweredBy"
check_contains "apps/web/core/components/branding/VritBrand.tsx" "vrittechnologies.com" "VritBrand links vrittechnologies.com"

echo "== Auth hooks (web) =="
check_contains "apps/web/core/components/auth-screens/header.tsx" "VritLogo"      "auth header renders VritLogo"
check_contains "apps/web/core/components/auth-screens/footer.tsx" "VritPoweredBy" "auth footer renders VritPoweredBy"

echo "== Favicons =="
check_contains "apps/web/app/root.tsx"     "/vrit-fav.png" "web root.tsx favicon"
check_contains "apps/web/app/layout.tsx"   "/vrit-fav.png" "web layout.tsx favicon"
check_contains "apps/admin/app/root.tsx"   "/vrit-fav.png" "admin root.tsx favicon"
check_contains "apps/space/app/root.tsx"   "/vrit-fav.png" "space root.tsx favicon"

echo "== Product name =="
check_contains "packages/constants/src/metadata.ts" "Vrit Tech" "metadata.ts SITE_NAME = Vrit Tech"

echo
if [ "$fail" -eq 0 ]; then
  printf '\033[32mBranding intact.\033[0m\n'
else
  printf '\033[31mBranding INCOMPLETE — re-apply the MISS items above (see BRANDING.md).\033[0m\n'
fi
exit "$fail"
