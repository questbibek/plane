/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useState } from "react";
import { TOAST_TYPE, setToast } from "@plane/propel/toast";
// plane web hooks
import type { EPageStoreType } from "@/plane-web/hooks/store";
import { usePageStore } from "@/plane-web/hooks/store";
// local imports
import { getFolderDragItem, hasFolderDragItem } from "./helpers";

/**
 * Makes an element accept dragged pages and folders, moving them into `folderId`
 * (null = project root).
 */
export const useFolderDropTarget = (folderId: string | null, storeType: EPageStoreType, disabled = false) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const { movePageToFolder, updateFolder, getFolderPath } = usePageStore(storeType);

  const onDragOver = (e: React.DragEvent) => {
    if (disabled || !hasFolderDragItem(e)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (!isDragOver) setIsDragOver(true);
  };

  const onDragLeave = (e: React.DragEvent) => {
    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
    setIsDragOver(false);
  };

  const onDrop = async (e: React.DragEvent) => {
    setIsDragOver(false);
    if (disabled) return;
    const item = getFolderDragItem(e);
    if (!item) return;
    e.preventDefault();

    try {
      if (item.kind === "page") {
        await movePageToFolder(item.id, folderId);
        return;
      }
      // a folder cannot be dropped into itself or anything nested under it
      if (folderId && getFolderPath(folderId).some((folder) => folder.id === item.id)) {
        setToast({ type: TOAST_TYPE.ERROR, title: "Error!", message: "A folder cannot be moved into itself." });
        return;
      }
      await updateFolder(item.id, { parent: folderId });
    } catch (error) {
      const message = (error as { error?: string } | undefined)?.error;
      setToast({ type: TOAST_TYPE.ERROR, title: "Error!", message: message ?? "Could not move. Please try again." });
    }
  };

  return { isDragOver, dropTargetProps: { onDragOver, onDragLeave, onDrop } };
};
