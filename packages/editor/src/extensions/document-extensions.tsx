/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { HocuspocusProvider } from "@hocuspocus/provider";
import type { AnyExtension } from "@tiptap/core";
import { Mic } from "lucide-react";
import { SlashCommands } from "@/extensions";
import { VoiceNoteExtension } from "@/extensions/voice-note";
// types
import type { IEditorProps, TExtensions, TUserDetails } from "@/types";

export type TDocumentEditorAdditionalExtensionsProps = Pick<
  IEditorProps,
  "disabledExtensions" | "flaggedExtensions" | "fileHandler" | "extendedEditorProps"
> & {
  isEditable: boolean;
  provider?: HocuspocusProvider;
  userDetails: TUserDetails;
};

export type TDocumentEditorAdditionalExtensionsRegistry = {
  isEnabled: (disabledExtensions: TExtensions[], flaggedExtensions: TExtensions[]) => boolean;
  getExtension: (props: TDocumentEditorAdditionalExtensionsProps) => AnyExtension;
};

const extensionRegistry: TDocumentEditorAdditionalExtensionsRegistry[] = [
  {
    isEnabled: (disabledExtensions) => !disabledExtensions.includes("slash-commands"),
    getExtension: ({ disabledExtensions, flaggedExtensions }) =>
      SlashCommands({
        disabledExtensions,
        flaggedExtensions,
        // voice notes are a pages-only block, so the command is added here rather than in the shared list
        additionalOptions: [
          {
            commandKey: "voice-note",
            key: "voice-note",
            title: "Voice note",
            description: "Record or upload audio",
            searchTerms: ["audio", "record", "voice", "mic", "microphone", "sound"],
            icon: <Mic className="size-3.5" />,
            command: ({ editor, range }) => editor.chain().focus().deleteRange(range).insertVoiceNote().run(),
            section: "general",
            pushAfter: "image",
          },
        ],
      }),
  },
  {
    isEnabled: () => true,
    getExtension: ({ fileHandler, userDetails }) => VoiceNoteExtension({ fileHandler, userName: userDetails.name }),
  },
];

export function DocumentEditorAdditionalExtensions(props: TDocumentEditorAdditionalExtensionsProps) {
  const { disabledExtensions, flaggedExtensions } = props;

  const documentExtensions = extensionRegistry
    .filter((config) => config.isEnabled(disabledExtensions, flaggedExtensions))
    .map((config) => config.getExtension(props));

  return documentExtensions;
}
