/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Download, Loader2, Mic, Pause, Play, RotateCcw, RotateCw } from "lucide-react";
// plane imports
import { cn } from "@plane/utils";
// local imports
import { PLAYBACK_RATES, SKIP_SECONDS, formatDuration, parsePeaks } from "../utils";
import { Waveform } from "./waveform";

const RATE_STORAGE_KEY = "plane:voice-note-rate";

// only one voice note on the page plays at a time
let activeAudio: HTMLAudioElement | null = null;

const readSavedRate = (): number => {
  try {
    const saved = Number(window.localStorage.getItem(RATE_STORAGE_KEY));
    return PLAYBACK_RATES.includes(saved as (typeof PLAYBACK_RATES)[number]) ? saved : 1;
  } catch {
    return 1;
  }
};

type Props = {
  assetId: string;
  duration: number | null;
  peaks: string | null;
  fileName: string | null;
  recordedBy: string | null;
  recordedAt: string | null;
  getAudioSource: (assetId: string) => Promise<string>;
  getAudioDownloadSource: (assetId: string) => Promise<string>;
  /** un-deletes the file on the server, for a note that came back after its file was marked deleted */
  restoreAudio?: (assetId: string) => Promise<void>;
};

export function VoiceNotePlayer(props: Props) {
  const {
    assetId,
    duration,
    peaks,
    fileName,
    recordedBy,
    recordedAt,
    getAudioSource,
    getAudioDownloadSource,
    restoreAudio,
  } = props;
  // refs
  const audioRef = useRef<HTMLAudioElement>(null);
  const hasTriedRestoreRef = useRef(false);
  // states
  const [src, setSrc] = useState<string>();
  const [isPlaying, setIsPlaying] = useState(false);
  const [isBuffering, setIsBuffering] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [mediaDuration, setMediaDuration] = useState<number | null>(null);
  const [rate, setRate] = useState(readSavedRate);
  const [hasError, setHasError] = useState(false);
  // derived values
  const levels = useMemo(() => parsePeaks(peaks), [peaks]);
  // the recorded length is exact; the media element can report Infinity for some formats
  const totalDuration = duration ?? mediaDuration ?? 0;
  const progress = totalDuration > 0 ? Math.min(1, currentTime / totalDuration) : 0;

  useEffect(() => {
    let cancelled = false;
    getAudioSource(assetId)
      .then((url) => !cancelled && setSrc(url))
      .catch(() => !cancelled && setHasError(true));
    return () => {
      cancelled = true;
    };
  }, [assetId, getAudioSource]);

  useEffect(() => {
    if (audioRef.current) audioRef.current.playbackRate = rate;
  }, [rate, src]);

  useEffect(
    () => () => {
      if (activeAudio === audioRef.current) activeAudio = null;
    },
    []
  );

  const togglePlay = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (!audio.paused) {
      audio.pause();
      return;
    }
    if (activeAudio && activeAudio !== audio) activeAudio.pause();
    activeAudio = audio;
    audio.playbackRate = rate;
    setIsBuffering(true);
    audio.play().catch(() => {
      setIsBuffering(false);
      setHasError(true);
    });
  }, [rate]);

  const seekTo = useCallback(
    (seconds: number) => {
      const audio = audioRef.current;
      if (!audio) return;
      const clamped = Math.max(0, totalDuration > 0 ? Math.min(totalDuration, seconds) : seconds);
      audio.currentTime = clamped;
      setCurrentTime(clamped);
    },
    [totalDuration]
  );

  const skip = (seconds: number) => seekTo((audioRef.current?.currentTime ?? 0) + seconds);

  const cycleRate = () => {
    const next =
      PLAYBACK_RATES[(PLAYBACK_RATES.indexOf(rate as (typeof PLAYBACK_RATES)[number]) + 1) % PLAYBACK_RATES.length];
    setRate(next);
    try {
      window.localStorage.setItem(RATE_STORAGE_KEY, String(next));
    } catch {
      // remembering the speed is only a convenience
    }
  };

  // the file may be marked deleted (the block was removed, then brought back by someone else's undo):
  // restore it once and load again before giving up
  const handleLoadError = async () => {
    if (!restoreAudio || hasTriedRestoreRef.current) {
      setHasError(true);
      return;
    }
    hasTriedRestoreRef.current = true;
    try {
      await restoreAudio(assetId);
      audioRef.current?.load();
    } catch {
      setHasError(true);
    }
  };

  const handleDownload = async () => {
    const url = await getAudioDownloadSource(assetId);
    if (!url) return;
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName ?? "voice-note.mp3";
    link.rel = "noopener";
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "ArrowLeft" || event.key === "j") {
      event.preventDefault();
      skip(-SKIP_SECONDS);
    } else if (event.key === "ArrowRight" || event.key === "l") {
      event.preventDefault();
      skip(SKIP_SECONDS);
    } else if (event.key === "k") {
      event.preventDefault();
      togglePlay();
    }
  };

  const recordedLabel = [
    recordedBy,
    recordedAt
      ? new Date(recordedAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })
      : undefined,
  ]
    .filter(Boolean)
    .join(" · ");

  const controlClassName =
    "grid size-7 shrink-0 place-items-center rounded-md text-secondary transition-colors hover:bg-layer-1-hover hover:text-primary disabled:opacity-50";

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-subtle bg-layer-1 px-3 py-2.5">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={togglePlay}
          onKeyDown={handleKeyDown}
          disabled={!src || hasError}
          className="grid size-9 shrink-0 place-items-center rounded-full bg-accent-primary text-on-color transition-opacity hover:opacity-90 disabled:opacity-50"
          aria-label={isPlaying ? "Pause voice note" : "Play voice note"}
          title={isPlaying ? "Pause (K)" : "Play (K)"}
        >
          {isBuffering && isPlaying ? (
            <Loader2 className="size-4 animate-spin" />
          ) : isPlaying ? (
            <Pause className="size-4 fill-current" />
          ) : (
            <Play className="ml-0.5 size-4 fill-current" />
          )}
        </button>

        <button
          type="button"
          onClick={() => skip(-SKIP_SECONDS)}
          disabled={!src}
          className={controlClassName}
          aria-label={`Back ${SKIP_SECONDS} seconds`}
          title={`Back ${SKIP_SECONDS} seconds (←)`}
        >
          <RotateCcw className="size-3.5" />
        </button>

        <Waveform
          levels={levels}
          progress={progress}
          duration={totalDuration}
          currentTime={currentTime}
          onSeek={seekTo}
          disabled={!src || totalDuration <= 0}
        />

        <button
          type="button"
          onClick={() => skip(SKIP_SECONDS)}
          disabled={!src}
          className={controlClassName}
          aria-label={`Forward ${SKIP_SECONDS} seconds`}
          title={`Forward ${SKIP_SECONDS} seconds (→)`}
        >
          <RotateCw className="size-3.5" />
        </button>

        <span className="w-[5.5rem] shrink-0 text-right text-11 text-tertiary tabular-nums">
          {formatDuration(currentTime)} / {formatDuration(totalDuration)}
        </span>

        <button
          type="button"
          onClick={cycleRate}
          className="h-7 min-w-11 shrink-0 rounded-md border border-subtle px-1.5 text-11 font-medium text-secondary tabular-nums transition-colors hover:bg-layer-1-hover hover:text-primary"
          aria-label={`Playback speed ${rate}x, click to change`}
          title="Playback speed"
        >
          {rate}×
        </button>

        <button
          type="button"
          onClick={() => void handleDownload()}
          className={controlClassName}
          aria-label="Download voice note"
          title="Download"
        >
          <Download className="size-3.5" />
        </button>
      </div>

      <div className="flex items-center gap-1.5 text-11 text-tertiary">
        <Mic className="size-3 shrink-0" />
        <span className="truncate">
          {hasError ? "This voice note could not be loaded." : recordedLabel || fileName || "Voice note"}
        </span>
      </div>

      {src && (
        // voice notes have no caption file; the player is hidden and driven by the controls above
        // eslint-disable-next-line jsx-a11y/media-has-caption
        <audio
          ref={audioRef}
          src={src}
          preload="metadata"
          className={cn("hidden")}
          onPlay={() => setIsPlaying(true)}
          onPause={() => {
            setIsPlaying(false);
            setIsBuffering(false);
          }}
          onPlaying={() => setIsBuffering(false)}
          onWaiting={() => setIsBuffering(true)}
          onEnded={() => {
            setIsPlaying(false);
            setCurrentTime(0);
            if (audioRef.current) audioRef.current.currentTime = 0;
          }}
          onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)}
          onLoadedMetadata={(event) => {
            const value = event.currentTarget.duration;
            if (Number.isFinite(value)) setMediaDuration(value);
            event.currentTarget.playbackRate = rate;
          }}
          onError={() => void handleLoadError()}
        />
      )}
    </div>
  );
}
