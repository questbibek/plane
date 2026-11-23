/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { NodeViewWrapper } from "@tiptap/react";
import type { NodeViewProps } from "@tiptap/react";
import { Mic, X } from "lucide-react";
// local imports
import type { TVoiceNoteAttributes, TVoiceNoteExtensionOptions, TVoiceNoteExtensionStorage } from "../types";
import { EVoiceNoteAttributeNames } from "../types";
import { VoiceNotePlayer } from "./player";
import { VoiceNoteRecorder } from "./recorder";

export function VoiceNoteNodeView(props: NodeViewProps) {
  const { editor, extension, node, updateAttributes, deleteNode } = props;
  // derived values
  const attrs = node.attrs as TVoiceNoteAttributes;
  const options = extension.options as TVoiceNoteExtensionOptions;
  const storage = extension.storage as TVoiceNoteExtensionStorage;
  const blockId = attrs[EVoiceNoteAttributeNames.ID] ?? "";
  const assetId = attrs[EVoiceNoteAttributeNames.SOURCE];
  const isOwnPendingBlock = storage.ownedBlockIds.has(blockId);

  const renderContent = () => {
    if (assetId)
      return (
        <VoiceNotePlayer
          assetId={assetId}
          duration={attrs[EVoiceNoteAttributeNames.DURATION]}
          peaks={attrs[EVoiceNoteAttributeNames.PEAKS]}
          fileName={attrs[EVoiceNoteAttributeNames.FILE_NAME]}
          recordedBy={attrs[EVoiceNoteAttributeNames.RECORDED_BY]}
          recordedAt={attrs[EVoiceNoteAttributeNames.RECORDED_AT]}
          getAudioSource={options.getAudioSource}
          getAudioDownloadSource={options.getAudioDownloadSource}
          restoreAudio={options.restoreAudio}
        />
      );

    if (editor.isEditable && isOwnPendingBlock)
      return (
        <VoiceNoteRecorder
          blockId={blockId}
          userName={options.userName}
          uploadAudio={options.uploadAudio}
          getUploadProgress={options.getUploadProgress}
          onSaved={(attributes) => {
            storage.ownedBlockIds.delete(blockId);
            updateAttributes(attributes);
          }}
          onRemove={() => {
            storage.ownedBlockIds.delete(blockId);
            deleteNode();
          }}
        />
      );

    // someone else is still recording, or a recording was abandoned before it was saved
    return (
      <div className="flex items-center gap-2 rounded-lg border border-dashed border-subtle bg-layer-1 px-3 py-2.5 text-13 text-tertiary">
        <Mic className="size-4 shrink-0" />
        <span className="flex-1">A voice note is being recorded…</span>
        {editor.isEditable && (
          <button
            type="button"
            onClick={deleteNode}
            className="grid size-7 place-items-center rounded-md transition-colors hover:bg-layer-1-hover hover:text-primary"
            aria-label="Remove voice note"
            title="Remove"
          >
            <X className="size-3.5" />
          </button>
        )}
      </div>
    );
  };

  return (
    <NodeViewWrapper className="editor-voice-note-component my-2" contentEditable={false}>
      {renderContent()}
    </NodeViewWrapper>
  );
}
