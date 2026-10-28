/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { TPageNavigationTabs } from "@plane/types";

// drag and drop payloads; the mime type doubles as the item kind so it can be read during dragover
const PAGE_DRAG_TYPE = "application/x-plane-page";
const FOLDER_DRAG_TYPE = "application/x-plane-folder";

export type TFolderDragItem = { kind: "page" | "folder"; id: string };

export const setFolderDragItem = (e: React.DragEvent, item: TFolderDragItem) => {
  e.dataTransfer.setData(item.kind === "page" ? PAGE_DRAG_TYPE : FOLDER_DRAG_TYPE, item.id);
  e.dataTransfer.effectAllowed = "move";
};

export const hasFolderDragItem = (e: React.DragEvent) =>
  e.dataTransfer.types.includes(PAGE_DRAG_TYPE) || e.dataTransfer.types.includes(FOLDER_DRAG_TYPE);

export const getFolderDragItem = (e: React.DragEvent): TFolderDragItem | undefined => {
  const pageId = e.dataTransfer.getData(PAGE_DRAG_TYPE);
  if (pageId) return { kind: "page", id: pageId };
  const folderId = e.dataTransfer.getData(FOLDER_DRAG_TYPE);
  if (folderId) return { kind: "folder", id: folderId };
  return undefined;
};

export const getPagesFolderHref = (
  workspaceSlug: string,
  projectId: string,
  pageType: TPageNavigationTabs,
  folderId: string | null
) => `/${workspaceSlug}/projects/${projectId}/pages?type=${pageType}${folderId ? `&folder=${folderId}` : ""}`;
