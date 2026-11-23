/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

/* >>> VRIT BRANDING (see BRANDING.md)
   Upstream renders a "Join 10,000+ teams building with Plane" line plus a strip
   of customer logos (Zerodha/Sony/Dolby/Accenture). Those are misleading on a
   Vrit deploy, so the whole footer is replaced with the Vrit "Powered by" mark.
   To restore upstream, revert this file. */
import { VritPoweredBy } from "@/components/branding/VritBrand";

export function AuthFooter() {
  return (
    <div className="flex flex-col items-center gap-6">
      <VritPoweredBy />
    </div>
  );
}
/* <<< VRIT BRANDING */
