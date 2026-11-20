/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { cn } from "@plane/utils";
// local imports
import { WAVEFORM_BARS, formatDuration } from "../utils";

// flat bars when a note has no stored waveform (e.g. a very large uploaded file)
const FLAT_LEVELS = Array.from({ length: WAVEFORM_BARS }, () => 0.3);

type Props = {
  levels: number[];
  /** 0..1 */
  progress: number;
  duration: number;
  currentTime: number;
  onSeek?: (seconds: number) => void;
  disabled?: boolean;
  className?: string;
};

/** Waveform with a transparent native slider on top, so seeking works by click, drag and keyboard. */
export function Waveform(props: Props) {
  const { levels, progress, duration, currentTime, onSeek, disabled = false, className } = props;
  const bars = levels.length > 0 ? levels : FLAT_LEVELS;

  return (
    <div className={cn("relative flex h-9 min-w-0 flex-1 items-center", className)}>
      <div className="pointer-events-none flex h-full w-full items-center gap-px" aria-hidden>
        {bars.map((level, index) => (
          <span
            // bars are fixed positions that never reorder, so the index is their identity
            // eslint-disable-next-line react/no-array-index-key
            key={index}
            className={cn("min-w-px flex-1 rounded-full transition-colors", {
              "bg-accent-primary": (index + 0.5) / bars.length <= progress,
              "bg-layer-3": (index + 0.5) / bars.length > progress,
            })}
            style={{ height: `${Math.round(level * 100)}%` }}
          />
        ))}
      </div>
      {onSeek && (
        <input
          type="range"
          min={0}
          max={duration || 0}
          step={0.1}
          value={Math.min(currentTime, duration || 0)}
          disabled={disabled}
          onChange={(event) => onSeek(Number(event.target.value))}
          className="absolute inset-0 size-full cursor-pointer opacity-0 disabled:cursor-default"
          aria-label="Seek"
          aria-valuetext={`${formatDuration(currentTime)} of ${formatDuration(duration)}`}
        />
      )}
    </div>
  );
}
