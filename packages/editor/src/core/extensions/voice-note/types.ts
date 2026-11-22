/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

// html attribute names are lower-case on purpose: the server-side HTML sanitizer matches them as written
export enum EVoiceNoteAttributeNames {
  ID = "id",
  SOURCE = "src",
  STATUS = "status",
  DURATION = "duration",
  PEAKS = "peaks",
  FILE_NAME = "file_name",
  RECORDED_BY = "recorded_by",
  RECORDED_AT = "recorded_at",
}

export enum EVoiceNoteStatus {
  /** inserted, waiting for a recording or a file */
  PENDING = "pending",
  UPLOADED = "uploaded",
}

export type TVoiceNoteAttributes = {
  [EVoiceNoteAttributeNames.ID]: string | null;
  /** asset id of the audio file */
  [EVoiceNoteAttributeNames.SOURCE]: string | null;
  [EVoiceNoteAttributeNames.STATUS]: EVoiceNoteStatus;
  /** seconds */
  [EVoiceNoteAttributeNames.DURATION]: number | null;
  /** waveform: comma separated levels between 0 and 1 */
  [EVoiceNoteAttributeNames.PEAKS]: string | null;
  [EVoiceNoteAttributeNames.FILE_NAME]: string | null;
  [EVoiceNoteAttributeNames.RECORDED_BY]: string | null;
  /** ISO timestamp */
  [EVoiceNoteAttributeNames.RECORDED_AT]: string | null;
};

export type TVoiceNoteFileHandlers = {
  getAudioSource: (assetId: string) => Promise<string>;
  getAudioDownloadSource: (assetId: string) => Promise<string>;
  restoreAudio: (assetId: string) => Promise<void>;
  uploadAudio?: (blockId: string, file: File) => Promise<string>;
  getUploadProgress: (blockId: string) => number | undefined;
};

export type TVoiceNoteExtensionOptions = TVoiceNoteFileHandlers & {
  /** name shown as "recorded by" on new notes */
  userName: string;
};

export type TVoiceNoteExtensionStorage = {
  /** blocks inserted in this editor session; only these show the recorder, others see a placeholder */
  ownedBlockIds: Set<string>;
  /** asset id => whether its block was removed; read by the editor's file deletion/restore tracking */
  deletedVoiceNoteSet: Map<string, boolean>;
};
