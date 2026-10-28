/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { CloseIcon } from "@plane/propel/icons";
import { cn } from "@plane/utils";

// stable hue per tag (case-insensitive) so the same tag looks the same everywhere
const getTagHue = (tag: string) => {
  let hash = 0;
  for (const char of tag.toLowerCase()) hash = (hash * 31 + char.charCodeAt(0)) % 360;
  return hash;
};

type Props = {
  tag: string;
  onClick?: () => void;
  onRemove?: () => void;
  isActive?: boolean;
  className?: string;
};

export function PageTagChip(props: Props) {
  const { tag, onClick, onRemove, isActive = false, className } = props;
  const hue = getTagHue(tag);

  return (
    <span
      className={cn(
        "inline-flex h-5 max-w-40 shrink-0 items-center gap-1 rounded-full border border-subtle bg-layer-2 px-2 text-11 text-secondary",
        { "border-accent-strong text-accent-primary": isActive },
        className
      )}
    >
      <span className="size-1.5 shrink-0 rounded-full" style={{ backgroundColor: `hsl(${hue} 65% 55%)` }} />
      {onClick ? (
        <button
          type="button"
          className="truncate hover:text-primary"
          title={`Filter by "${tag}"`}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onClick();
          }}
        >
          {tag}
        </button>
      ) : (
        <span className="truncate">{tag}</span>
      )}
      {onRemove && (
        <button
          type="button"
          aria-label={`Remove tag ${tag}`}
          className="grid shrink-0 place-items-center text-tertiary hover:text-primary"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onRemove();
          }}
        >
          <CloseIcon height={10} width={10} strokeWidth={2} />
        </button>
      )}
    </span>
  );
}
