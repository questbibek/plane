/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { ReactNodeViewRenderer } from "@tiptap/react";
import { v4 as uuidv4 } from "uuid";
// helpers
import { insertEmptyParagraphAtNodeBoundaries } from "@/helpers/insert-empty-paragraph-at-node-boundary";
// types
import type { TFileHandler } from "@/types";
// local imports
import { VoiceNoteNodeView } from "./components/node-view";
import { VoiceNoteExtensionConfig } from "./extension-config";
import type { TVoiceNoteExtensionOptions, TVoiceNoteExtensionStorage } from "./types";
import { EVoiceNoteAttributeNames, EVoiceNoteStatus } from "./types";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    voiceNote: {
      insertVoiceNote: (props?: { pos?: number }) => ReturnType;
    };
  }
}

type Props = {
  fileHandler: TFileHandler;
  userName: string;
};

export function VoiceNoteExtension(props: Props) {
  const { fileHandler, userName } = props;

  return VoiceNoteExtensionConfig.extend<TVoiceNoteExtensionOptions, TVoiceNoteExtensionStorage>({
    addOptions() {
      return {
        userName,
        getAudioSource: fileHandler.getAssetSrc,
        getAudioDownloadSource: fileHandler.getAssetDownloadSrc,
        uploadAudio: "upload" in fileHandler ? fileHandler.upload : undefined,
        getUploadProgress: (blockId: string) => fileHandler.assetsUploadStatus?.[blockId],
      };
    },

    addStorage() {
      return {
        ...this.parent?.(),
        ownedBlockIds: new Set<string>(),
      };
    },

    addCommands() {
      return {
        insertVoiceNote:
          (commandProps) =>
          ({ commands }) => {
            const blockId = uuidv4();
            // only the editor that inserted the block shows the recorder
            this.storage.ownedBlockIds.add(blockId);
            const content = {
              type: this.name,
              attrs: {
                [EVoiceNoteAttributeNames.ID]: blockId,
                [EVoiceNoteAttributeNames.STATUS]: EVoiceNoteStatus.PENDING,
              },
            };
            return commandProps?.pos !== undefined
              ? commands.insertContentAt(commandProps.pos, content)
              : commands.insertContent(content);
          },
      };
    },

    addKeyboardShortcuts() {
      return {
        ArrowDown: insertEmptyParagraphAtNodeBoundaries("down", this.name),
        ArrowUp: insertEmptyParagraphAtNodeBoundaries("up", this.name),
      };
    },

    addNodeView() {
      return ReactNodeViewRenderer(VoiceNoteNodeView);
    },
  });
}
