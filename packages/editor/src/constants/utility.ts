/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

// plane imports
import { CORE_EXTENSIONS } from "@plane/utils";
// plane editor imports
import type { ExtensionFileSetStorageKey } from "@/types/storage";

export type NodeFileMapType = Partial<
  Record<
    CORE_EXTENSIONS.IMAGE | CORE_EXTENSIONS.CUSTOM_IMAGE | CORE_EXTENSIONS.VOICE_NOTE,
    {
      fileSetName: ExtensionFileSetStorageKey;
    }
  >
>;

export const NODE_FILE_MAP: NodeFileMapType = {
  [CORE_EXTENSIONS.IMAGE]: {
    fileSetName: "deletedImageSet",
  },
  [CORE_EXTENSIONS.CUSTOM_IMAGE]: {
    fileSetName: "deletedImageSet",
  },
  // a removed voice note's audio is marked deleted (and restored on undo) the same way as an image
  [CORE_EXTENSIONS.VOICE_NOTE]: {
    fileSetName: "deletedVoiceNoteSet",
  },
};
