/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useEffect, useRef, useState } from "react";
import { Check, Loader2, Mic, Pause, Play, Trash2, Upload, X } from "lucide-react";
// plane imports
import { cn } from "@plane/utils";
// local imports
import { Mp3Recorder } from "../mp3-recorder";
import type { TVoiceNoteAttributes } from "../types";
import { EVoiceNoteAttributeNames, EVoiceNoteStatus } from "../types";
import { analyseAudioFile, formatDuration, serializePeaks, toWaveform, voiceNoteFileName } from "../utils";
import { Waveform } from "./waveform";

// bars shown while recording: the most recent few seconds
const LIVE_BARS = 80;

type TStage = "idle" | "recording" | "saving";

type Props = {
  blockId: string;
  userName: string;
  uploadAudio?: (blockId: string, file: File) => Promise<string>;
  getUploadProgress: (blockId: string) => number | undefined;
  onSaved: (attributes: Partial<TVoiceNoteAttributes>) => void;
  onRemove: () => void;
};

const describeError = (error: unknown): string => {
  const name = (error as { name?: string } | undefined)?.name;
  if (name === "NotAllowedError" || name === "SecurityError")
    return "Microphone access is blocked. Allow it for this site in your browser settings, then try again.";
  if (name === "NotFoundError") return "No microphone was found on this device.";
  const message = (error as { error?: string; message?: string } | undefined)?.error;
  return message ?? "Something went wrong. Please try again.";
};

export function VoiceNoteRecorder(props: Props) {
  const { blockId, userName, uploadAudio, getUploadProgress, onSaved, onRemove } = props;
  // refs
  const recorderRef = useRef<Mp3Recorder | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // states
  const [stage, setStage] = useState<TStage>("idle");
  const [isPaused, setIsPaused] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [liveLevels, setLiveLevels] = useState<number[]>([]);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // stop the microphone if the block goes away mid-recording
  useEffect(
    () => () => {
      void recorderRef.current?.cancel();
    },
    []
  );

  // tick the timer while recording
  useEffect(() => {
    if (stage !== "recording") return;
    const timer = window.setInterval(() => setElapsed(recorderRef.current?.elapsed ?? 0), 200);
    return () => window.clearInterval(timer);
  }, [stage]);

  // the upload progress lives in the app's store; poll it while saving
  useEffect(() => {
    if (stage !== "saving") return;
    const timer = window.setInterval(() => setUploadProgress(getUploadProgress(blockId) ?? 0), 250);
    return () => window.clearInterval(timer);
  }, [stage, blockId, getUploadProgress]);

  const upload = async (file: File, details: { duration: number | null; peaks: string | null }) => {
    if (!uploadAudio) {
      setError("Voice notes can't be saved here.");
      setStage("idle");
      return;
    }
    setStage("saving");
    setUploadProgress(0);
    try {
      const assetId = await uploadAudio(blockId, file);
      onSaved({
        [EVoiceNoteAttributeNames.SOURCE]: assetId,
        [EVoiceNoteAttributeNames.STATUS]: EVoiceNoteStatus.UPLOADED,
        [EVoiceNoteAttributeNames.DURATION]: details.duration,
        [EVoiceNoteAttributeNames.PEAKS]: details.peaks,
        [EVoiceNoteAttributeNames.FILE_NAME]: file.name,
        [EVoiceNoteAttributeNames.RECORDED_BY]: userName || null,
        [EVoiceNoteAttributeNames.RECORDED_AT]: new Date().toISOString(),
      });
    } catch (uploadError) {
      setError(describeError(uploadError));
      setStage("idle");
    }
  };

  const startRecording = async () => {
    setError(null);
    const recorder = new Mp3Recorder();
    recorder.onLevel = (level) => setLiveLevels((levels) => [...levels.slice(-(LIVE_BARS - 1)), level]);
    try {
      await recorder.start();
      recorderRef.current = recorder;
      setElapsed(0);
      setLiveLevels([]);
      setIsPaused(false);
      setStage("recording");
    } catch (startError) {
      await recorder.cancel();
      setError(describeError(startError));
    }
  };

  const togglePause = () => {
    const recorder = recorderRef.current;
    if (!recorder) return;
    if (recorder.isPaused) recorder.resume();
    else recorder.pause();
    setIsPaused(recorder.isPaused);
  };

  const discardRecording = async () => {
    await recorderRef.current?.cancel();
    recorderRef.current = null;
    setStage("idle");
  };

  const saveRecording = async () => {
    const recorder = recorderRef.current;
    if (!recorder) return;
    recorderRef.current = null;
    const recording = await recorder.stop();
    if (recording.duration < 0.5) {
      setError("That recording was too short to keep.");
      setStage("idle");
      return;
    }
    const file = new File([recording.file], voiceNoteFileName(), { type: "audio/mpeg" });
    await upload(file, {
      duration: Math.round(recording.duration * 10) / 10,
      peaks: serializePeaks(toWaveform(recording.levels)),
    });
  };

  const handleFileChosen = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setError(null);
    setStage("saving");
    const { duration, peaks } = await analyseAudioFile(file);
    await upload(file, {
      duration: duration === null ? null : Math.round(duration * 10) / 10,
      peaks: peaks.length > 0 ? serializePeaks(peaks) : null,
    });
  };

  const buttonClassName =
    "flex h-8 items-center gap-1.5 rounded-md border border-subtle px-2.5 text-13 font-medium text-secondary transition-colors hover:bg-layer-1-hover hover:text-primary";

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-dashed border-strong bg-layer-1 px-3 py-2.5">
      {stage === "idle" && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="mr-1 flex items-center gap-1.5 text-13 font-medium text-primary">
            <Mic className="size-4 text-tertiary" />
            Voice note
          </span>
          <button
            type="button"
            onClick={() => void startRecording()}
            className={cn(
              buttonClassName,
              "border-transparent bg-accent-primary text-on-color hover:bg-accent-primary hover:text-on-color hover:opacity-90"
            )}
          >
            <span className="size-2 rounded-full bg-current" />
            Record
          </button>
          <button type="button" onClick={() => fileInputRef.current?.click()} className={buttonClassName}>
            <Upload className="size-3.5" />
            Upload audio
          </button>
          <button
            type="button"
            onClick={onRemove}
            className="ml-auto grid size-7 place-items-center rounded-md text-tertiary transition-colors hover:bg-layer-1-hover hover:text-primary"
            aria-label="Remove voice note"
            title="Remove"
          >
            <X className="size-3.5" />
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="audio/*,.mp3,.m4a,.wav,.ogg,.opus,.webm,.flac,.aac"
            className="hidden"
            onChange={(event) => void handleFileChosen(event)}
          />
        </div>
      )}

      {stage === "recording" && (
        <div className="flex items-center gap-2">
          <span
            className={cn("size-2.5 shrink-0 rounded-full bg-danger-primary", { "animate-pulse": !isPaused })}
            aria-hidden
          />
          <span className="w-14 shrink-0 text-13 font-medium text-primary tabular-nums">{formatDuration(elapsed)}</span>
          <Waveform
            levels={[...Array.from({ length: LIVE_BARS - liveLevels.length }, () => 0.04), ...liveLevels]}
            progress={1}
            duration={0}
            currentTime={0}
            className={cn({ "opacity-50": isPaused })}
          />
          <button type="button" onClick={togglePause} className={buttonClassName}>
            {isPaused ? <Play className="size-3.5" /> : <Pause className="size-3.5" />}
            {isPaused ? "Resume" : "Pause"}
          </button>
          <button
            type="button"
            onClick={() => void saveRecording()}
            className={cn(
              buttonClassName,
              "border-transparent bg-accent-primary text-on-color hover:bg-accent-primary hover:text-on-color hover:opacity-90"
            )}
          >
            <Check className="size-3.5" />
            Save
          </button>
          <button
            type="button"
            onClick={() => void discardRecording()}
            className="grid size-8 shrink-0 place-items-center rounded-md text-tertiary transition-colors hover:bg-layer-1-hover hover:text-danger-primary"
            aria-label="Discard recording"
            title="Discard"
          >
            <Trash2 className="size-3.5" />
          </button>
        </div>
      )}

      {stage === "saving" && (
        <div className="flex items-center gap-2 text-13 text-secondary">
          <Loader2 className="size-4 animate-spin" />
          Saving voice note{uploadProgress > 0 ? ` · ${Math.round(uploadProgress)}%` : "…"}
        </div>
      )}

      {error && <p className="text-11 text-danger-primary">{error}</p>}
    </div>
  );
}
