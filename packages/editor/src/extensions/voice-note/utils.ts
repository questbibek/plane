/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

/** Bars drawn in the waveform. */
export const WAVEFORM_BARS = 120;

export const PLAYBACK_RATES = [0.75, 1, 1.25, 1.5, 1.75, 2] as const;

export const SKIP_SECONDS = 10;

/** 75 -> "1:15", 3725 -> "1:02:05" */
export const formatDuration = (totalSeconds: number): string => {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const rest = String(seconds % 60).padStart(2, "0");
  return hours > 0 ? `${hours}:${String(minutes).padStart(2, "0")}:${rest}` : `${minutes}:${rest}`;
};

export const parsePeaks = (value: string | null | undefined): number[] =>
  (value ?? "")
    .split(",")
    .map((part) => Number.parseFloat(part))
    .filter((level) => Number.isFinite(level));

export const serializePeaks = (levels: number[]): string => levels.map((level) => level.toFixed(2)).join(",");

/**
 * Squash any number of loudness samples into `bars` levels between 0 and 1,
 * scaled so the loudest bar fills the height.
 */
export const toWaveform = (levels: number[], bars = WAVEFORM_BARS): number[] => {
  if (levels.length === 0) return [];
  const buckets: number[] = [];
  const size = levels.length / bars;
  for (let bar = 0; bar < bars; bar++) {
    const start = Math.floor(bar * size);
    const end = Math.max(start + 1, Math.floor((bar + 1) * size));
    let peak = 0;
    for (let index = start; index < end && index < levels.length; index++) peak = Math.max(peak, levels[index]);
    buckets.push(peak);
  }
  const loudest = Math.max(...buckets) || 1;
  return buckets.map((level) => Math.max(0.04, level / loudest));
};

/** "Voice note – 21 Nov 2026, 14.05.mp3" */
export const voiceNoteFileName = (date = new Date()): string => {
  const day = date.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
  const time = `${String(date.getHours()).padStart(2, "0")}.${String(date.getMinutes()).padStart(2, "0")}`;
  return `Voice note – ${day}, ${time}.mp3`;
};

/** Reads length and waveform from an uploaded audio file. The waveform is skipped for very large files. */
export const analyseAudioFile = async (file: File): Promise<{ duration: number | null; peaks: number[] }> => {
  const url = URL.createObjectURL(file);
  try {
    const duration = await new Promise<number | null>((resolve) => {
      const audio = new Audio();
      audio.preload = "metadata";
      audio.addEventListener("loadedmetadata", () => resolve(Number.isFinite(audio.duration) ? audio.duration : null), {
        once: true,
      });
      audio.addEventListener("error", () => resolve(null), { once: true });
      audio.src = url;
    });
    // decoding needs the whole file in memory as raw samples, so only do it for files up to ~60 MB
    if (file.size > 60 * 1024 * 1024) return { duration, peaks: [] };
    try {
      const context = new AudioContext();
      const buffer = await context.decodeAudioData(await file.arrayBuffer());
      void context.close();
      const samples = buffer.getChannelData(0);
      const step = Math.max(1, Math.floor(samples.length / (WAVEFORM_BARS * 8)));
      const levels: number[] = [];
      for (let index = 0; index < samples.length; index += step) {
        let peak = 0;
        const end = Math.min(samples.length, index + step);
        for (let sample = index; sample < end; sample++) peak = Math.max(peak, Math.abs(samples[sample]));
        levels.push(peak);
      }
      return { duration: duration ?? buffer.duration, peaks: toWaveform(levels) };
    } catch {
      return { duration, peaks: [] };
    }
  } finally {
    URL.revokeObjectURL(url);
  }
};
