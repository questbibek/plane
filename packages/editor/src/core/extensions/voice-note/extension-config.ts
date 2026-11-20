/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { mergeAttributes, Node } from "@tiptap/core";
// constants
import { CORE_EXTENSIONS } from "@/constants/extension";
// local imports
import { EVoiceNoteAttributeNames, EVoiceNoteStatus } from "./types";
import type { TVoiceNoteAttributes } from "./types";
import { formatDuration } from "./utils";

export const DEFAULT_VOICE_NOTE_ATTRIBUTES: TVoiceNoteAttributes = {
  [EVoiceNoteAttributeNames.ID]: null,
  [EVoiceNoteAttributeNames.SOURCE]: null,
  [EVoiceNoteAttributeNames.STATUS]: EVoiceNoteStatus.PENDING,
  [EVoiceNoteAttributeNames.DURATION]: null,
  [EVoiceNoteAttributeNames.PEAKS]: null,
  [EVoiceNoteAttributeNames.FILE_NAME]: null,
  [EVoiceNoteAttributeNames.RECORDED_BY]: null,
  [EVoiceNoteAttributeNames.RECORDED_AT]: null,
};

/** Schema-only definition, shared by the editor and the collaboration server. */
export const VoiceNoteExtensionConfig = Node.create({
  name: CORE_EXTENSIONS.VOICE_NOTE,
  group: "block",
  atom: true,
  selectable: true,
  draggable: true,

  addAttributes() {
    return {
      ...Object.values(EVoiceNoteAttributeNames).reduce(
        (acc, name) => {
          acc[name] = { default: DEFAULT_VOICE_NOTE_ATTRIBUTES[name] };
          return acc;
        },
        {} as Record<EVoiceNoteAttributeNames, { default: unknown }>
      ),
      // read back from html as a number
      [EVoiceNoteAttributeNames.DURATION]: {
        default: null,
        parseHTML: (element: HTMLElement) => {
          const value = Number.parseFloat(element.getAttribute(EVoiceNoteAttributeNames.DURATION) ?? "");
          return Number.isFinite(value) ? value : null;
        },
      },
    };
  },

  parseHTML() {
    return [{ tag: "voice-note-component" }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["voice-note-component", mergeAttributes(HTMLAttributes)];
  },

  addStorage() {
    return {
      markdown: {
        serialize(
          state: { write: (text: string) => void; closeBlock: (node: unknown) => void },
          node: { attrs: TVoiceNoteAttributes }
        ) {
          const duration = node.attrs[EVoiceNoteAttributeNames.DURATION];
          state.write(`🎙 Voice note${duration ? ` (${formatDuration(duration)})` : ""}`);
          state.closeBlock(node);
        },
      },
    };
  },
});
