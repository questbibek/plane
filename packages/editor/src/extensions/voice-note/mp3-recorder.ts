/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { Mp3Encoder } from "@breezystack/lamejs";

const BITRATE_KBPS = 64; // clear speech at ~0.5 MB a minute
const FRAME_SIZE = 4096;

export type TMp3Recording = {
  file: Blob;
  duration: number;
  /** loudness per captured frame, 0..1 */
  levels: number[];
};

/**
 * Records the microphone straight to MP3 while it listens, so nothing large is held in memory and the
 * result plays, seeks and downloads the same in every browser (browser-native recordings are WebM or
 * MP4 fragments whose length and seeking are unreliable).
 */
export class Mp3Recorder {
  private stream: MediaStream | null = null;
  private context: AudioContext | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private processor: ScriptProcessorNode | null = null;
  private encoder: Mp3Encoder | null = null;
  private chunks: Uint8Array[] = [];
  private samples = 0;
  private paused = false;
  levels: number[] = [];

  /** latest loudness 0..1, for the live meter */
  onLevel?: (level: number) => void;

  async start() {
    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
    });
    this.context = new AudioContext();
    this.encoder = new Mp3Encoder(1, this.context.sampleRate, BITRATE_KBPS);
    this.source = this.context.createMediaStreamSource(this.stream);
    // ScriptProcessor is deprecated but, unlike AudioWorklet, needs no separate module file and works everywhere
    this.processor = this.context.createScriptProcessor(FRAME_SIZE, 1, 1);
    this.processor.onaudioprocess = (event) => this.handleFrame(event.inputBuffer.getChannelData(0));
    this.source.connect(this.processor);
    this.processor.connect(this.context.destination);
  }

  get elapsed() {
    return this.context ? this.samples / this.context.sampleRate : 0;
  }

  get isPaused() {
    return this.paused;
  }

  pause() {
    this.paused = true;
  }

  resume() {
    this.paused = false;
  }

  async stop(): Promise<TMp3Recording> {
    const duration = this.elapsed;
    const tail = this.encoder?.flush();
    if (tail?.length) this.chunks.push(tail);
    const file = new Blob(this.chunks as BlobPart[], { type: "audio/mpeg" });
    const levels = this.levels;
    await this.release();
    return { file, duration, levels };
  }

  /** Stop without keeping anything. */
  async cancel() {
    await this.release();
  }

  private handleFrame(input: Float32Array) {
    if (this.paused || !this.encoder) return;
    const pcm = new Int16Array(input.length);
    let sum = 0;
    for (let index = 0; index < input.length; index++) {
      const sample = Math.max(-1, Math.min(1, input[index]));
      pcm[index] = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
      sum += sample * sample;
    }
    const encoded = this.encoder.encodeBuffer(pcm);
    if (encoded.length) this.chunks.push(encoded);
    this.samples += input.length;
    const level = Math.min(1, Math.sqrt(sum / input.length) * 4);
    this.levels.push(level);
    this.onLevel?.(level);
  }

  private async release() {
    this.processor?.disconnect();
    this.source?.disconnect();
    this.stream?.getTracks().forEach((track) => track.stop());
    if (this.context && this.context.state !== "closed") await this.context.close();
    this.processor = null;
    this.source = null;
    this.stream = null;
    this.context = null;
    this.encoder = null;
    this.chunks = [];
  }
}
