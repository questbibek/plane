/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useState } from "react";
import { observer } from "mobx-react";
import { useParams, useSearchParams } from "next/navigation";
import { FolderOpen, FolderPlus } from "lucide-react";
import { EPageAccess } from "@plane/constants";
import { Button } from "@plane/propel/button";
import { TOAST_TYPE, setToast } from "@plane/propel/toast";
// types
import type { TPageNavigationTabs } from "@plane/types";
import { calculateTotalFilters, getPageName } from "@plane/utils";
// components
import { ListLayout } from "@/components/core/list";
import { PageFolderFormModal } from "@/components/pages/folders/folder-form-modal";
import { PageFolderItem } from "@/components/pages/folders/folder-item";
import { PageFolderToolbar } from "@/components/pages/folders/folder-toolbar";
import { getPagesFolderHref, setFolderDragItem } from "@/components/pages/folders/helpers";
import { MoveToFolderModal } from "@/components/pages/folders/move-to-folder-modal";
import { PageGridCard } from "@/components/pages/folders/page-grid-card";
// hooks
import { useAppRouter } from "@/hooks/use-app-router";
// plane web hooks
import type { EPageStoreType } from "@/plane-web/hooks/store";
import { usePageStore } from "@/plane-web/hooks/store";
// local imports
import { PageListBlock } from "./block";

type TPagesListRoot = {
  pageType: TPageNavigationTabs;
  storeType: EPageStoreType;
};

export const PagesListRoot = observer(function PagesListRoot(props: TPagesListRoot) {
  const { pageType, storeType } = props;
  // states
  const [movingPageId, setMovingPageId] = useState<string | null>(null);
  const [isCreatingPage, setIsCreatingPage] = useState(false);
  const [isFolderModalOpen, setIsFolderModalOpen] = useState(false);
  // router
  const router = useAppRouter();
  const { workspaceSlug, projectId } = useParams();
  const searchParams = useSearchParams();
  // store hooks
  const {
    canCurrentUserCreatePage,
    createPage,
    filters,
    folders,
    getChildFolders,
    getCurrentProjectFilteredPageIdsByTab,
    getFolderPath,
    getPageById,
    layout,
  } = usePageStore(storeType);
  // derived values
  const workspaceSlugStr = workspaceSlug?.toString() ?? "";
  const projectIdStr = projectId?.toString() ?? "";
  const filteredPageIds = getCurrentProjectFilteredPageIdsByTab(pageType);
  const folderParam = searchParams.get("folder");
  const currentFolderId = folderParam && folders[folderParam] ? folderParam : null;
  // searching, filtering and the archive show a flat list across all folders
  const isFlat = pageType === "archived" || !!filters.searchQuery || calculateTotalFilters(filters.filters ?? {}) !== 0;
  // a page whose folder is unknown (e.g. just deleted) is treated as sitting at the root
  const getPageFolderId = (pageId: string) => {
    const folderId = getPageById(pageId)?.folder ?? null;
    return folderId && folders[folderId] ? folderId : null;
  };
  const getFolderPathLabel = (pageId: string) => {
    const path = getFolderPath(getPageFolderId(pageId));
    return path.length ? path.map((folder) => folder.name).join(" / ") : undefined;
  };
  const visibleFolders = isFlat ? [] : getChildFolders(projectIdStr, currentFolderId);
  const visiblePageIds = (filteredPageIds ?? []).filter(
    (pageId) => isFlat || getPageFolderId(pageId) === currentFolderId
  );
  const movingPage = movingPageId ? getPageById(movingPageId) : undefined;

  const handleCreatePage = async () => {
    setIsCreatingPage(true);
    try {
      const page = await createPage({
        access: pageType === "private" ? EPageAccess.PRIVATE : EPageAccess.PUBLIC,
        folder: currentFolderId,
      });
      if (page?.id) router.push(`/${workspaceSlugStr}/projects/${projectIdStr}/pages/${page.id}`);
    } catch (error) {
      const message = (error as { error?: string } | undefined)?.error;
      setToast({ type: TOAST_TYPE.ERROR, title: "Error!", message: message ?? "Page could not be created." });
    } finally {
      setIsCreatingPage(false);
    }
  };

  if (!filteredPageIds) return <></>;

  const isEmpty = visibleFolders.length === 0 && visiblePageIds.length === 0;
  const getFolderHref = (folderId: string) => getPagesFolderHref(workspaceSlugStr, projectIdStr, pageType, folderId);
  const pageDragProps = (pageId: string) => ({
    draggable: canCurrentUserCreatePage && !isFlat,
    onDragStart: (e: React.DragEvent) => setFolderDragItem(e, { kind: "page", id: pageId }),
  });

  return (
    <div className="flex h-full w-full flex-col overflow-hidden">
      <PageFolderToolbar
        workspaceSlug={workspaceSlugStr}
        projectId={projectIdStr}
        pageType={pageType}
        storeType={storeType}
        currentFolderId={currentFolderId}
        showFolders={!isFlat}
      />
      {isEmpty ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center text-tertiary">
          <FolderOpen className="size-10" strokeWidth={1.25} />
          <p className="text-13">
            {isFlat ? "No pages match." : currentFolderId ? "This folder is empty." : "No pages here yet."}
          </p>
          {canCurrentUserCreatePage && !isFlat && (
            <div className="flex items-center gap-2">
              <Button variant="primary" size="sm" onClick={handleCreatePage} loading={isCreatingPage}>
                Add page
              </Button>
              <Button variant="secondary" size="sm" onClick={() => setIsFolderModalOpen(true)}>
                <FolderPlus className="size-3.5" />
                New folder
              </Button>
            </div>
          )}
        </div>
      ) : layout === "grid" ? (
        <div className="vertical-scrollbar scrollbar-lg flex-1 overflow-y-auto px-page-x py-4">
          <div className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-3">
            {visibleFolders.map((folder) => (
              <PageFolderItem
                key={folder.id}
                folder={folder}
                href={getFolderHref(folder.id)}
                layout="grid"
                storeType={storeType}
                workspaceSlug={workspaceSlugStr}
              />
            ))}
            {visiblePageIds.map((pageId) => (
              <div key={pageId} {...pageDragProps(pageId)}>
                <PageGridCard
                  pageId={pageId}
                  storeType={storeType}
                  onMoveToFolder={() => setMovingPageId(pageId)}
                  folderPath={isFlat ? getFolderPathLabel(pageId) : undefined}
                />
              </div>
            ))}
          </div>
        </div>
      ) : (
        <ListLayout>
          {visibleFolders.map((folder) => (
            <PageFolderItem
              key={folder.id}
              folder={folder}
              href={getFolderHref(folder.id)}
              layout="list"
              storeType={storeType}
              workspaceSlug={workspaceSlugStr}
            />
          ))}
          {visiblePageIds.map((pageId) => (
            <div key={pageId} {...pageDragProps(pageId)}>
              <PageListBlock
                pageId={pageId}
                storeType={storeType}
                onMoveToFolder={() => setMovingPageId(pageId)}
                folderPath={isFlat ? getFolderPathLabel(pageId) : undefined}
              />
            </div>
          ))}
        </ListLayout>
      )}
      <PageFolderFormModal
        isOpen={isFolderModalOpen}
        onClose={() => setIsFolderModalOpen(false)}
        storeType={storeType}
        parentId={currentFolderId}
      />
      {movingPage?.id && (
        <MoveToFolderModal
          isOpen
          onClose={() => setMovingPageId(null)}
          projectId={projectIdStr}
          storeType={storeType}
          item={{ kind: "page", id: movingPage.id }}
          itemName={getPageName(movingPage.name)}
          currentFolderId={getPageFolderId(movingPage.id)}
        />
      )}
    </div>
  );
});
