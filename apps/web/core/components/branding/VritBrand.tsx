/**
 * Vrit Tech branding component.
 *
 * This is a NEW file that upstream Plane does not have, so it can never cause a
 * merge conflict. All Vrit branding *logic* lives here; upstream-owned files
 * only get a small fenced `VRIT BRANDING` hook that imports from this module.
 * See BRANDING.md.
 *
 * Logos are served from each frontend's `public/` dir (vrit-{white,blue,fav}.png),
 * so they resolve at the site root with no bundler import needed.
 */
import { useTheme } from "next-themes";

export const VRIT_URL = "https://vrittechnologies.com";

// White wordmark reads on dark surfaces; blue reads on the light theme.
// Plane themes include "dark" and "dark-contrast" — match either as dark.
function useVritLogoSrc() {
  const { resolvedTheme } = useTheme();
  return resolvedTheme?.includes("dark") ? "/vrit-white.png" : "/vrit-blue.png";
}

export function VritLogo({ className = "" }: { className?: string }) {
  const src = useVritLogoSrc();
  return <img src={src} alt="Vrit Tech" className={className} />;
}

export function VritPoweredBy({ className = "" }: { className?: string }) {
  const src = useVritLogoSrc();
  return (
    <a
      href={VRIT_URL}
      target="_blank"
      rel="noopener noreferrer"
      className={`inline-flex items-center gap-1.5 text-xs text-tertiary transition-opacity hover:opacity-80 ${className}`}
    >
      <span>Powered by</span>
      <img src={src} alt="Vrit Tech" className="h-3.5 w-auto" />
    </a>
  );
}
