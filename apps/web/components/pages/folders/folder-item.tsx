/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useState } from "react";
import { observer } from "mobx-react";
import { Folder } from "lucide-react";
import { Icon } from "@makeplane/propel/components/icon";
import { IconButton } from "@makeplane/propel/components/icon-button";
import { Menu, MenuContent, MenuItem, MenuTrigger } from "@makeplane/propel/components/menu";
import { DeleteOutline, EditOutline, MoreHorizontalOutline, MovePageOutline } from "@makeplane/propel/icons";
import type { TPageFolder, TPageListLayout } from "@plane/types";
import { cn } from "@plane/utils";
// hooks
import { useAppRouter } from "@/hooks/use-app-router";
// plane web hooks
import type { EPageStoreType } from "@/hooks/store";
import { usePageStore } from "@/hooks/store";
// local imports
import { DeletePageFolderModal } from "./delete-folder-modal";
import { PageFolderFormModal } from "./folder-form-modal";
import { setFolderDragItem } from "./helpers";
import { MoveToFolderModal } from "./move-to-folder-modal";
import { useFolderDropTarget } from "./use-folder-drop-target";

type Props = {
  folder: TPageFolder;
  href: string;
  layout: TPageListLayout;
  storeType: EPageStoreType;
  workspaceSlug: string;
};

export const PageFolderItem = observer(function PageFolderItem(props: Props) {
  const { folder, href, layout, storeType, workspaceSlug } = props;
  // states
  const [modal, setModal] = useState<"rename" | "move" | "delete" | null>(null);
  // router
  const router = useAppRouter();
  // store hooks
  const { canCurrentUserCreatePage, getChildFolders, getCurrentProjectPageIds, getPageById } = usePageStore(storeType);
  const { isDragOver, dropTargetProps } = useFolderDropTarget(folder.id, storeType, !canCurrentUserCreatePage);
  // derived values
  const subFolderCount = getChildFolders(folder.project, folder.id).length;
  const pageCount = getCurrentProjectPageIds(folder.project).filter(
    (pageId) => getPageById(pageId)?.folder === folder.id && !getPageById(pageId)?.archived_at
  ).length;
  const summary = [
    subFolderCount > 0 && `${subFolderCount} folder${subFolderCount === 1 ? "" : "s"}`,
    `${pageCount} page${pageCount === 1 ? "" : "s"}`,
  ]
    .filter(Boolean)
    .join(" · ");

  const actions = canCurrentUserCreatePage && (
    <div onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()} role="presentation">
      <Menu>
        <MenuTrigger
          render={
            <IconButton
              variant="ghost"
              size="sm"
              aria-label="Folder actions"
              icon={<Icon icon={MoreHorizontalOutline} />}
            />
          }
        />
        <MenuContent side="bottom" align="end">
          <MenuItem icon={<Icon icon={EditOutline} />} label="Rename" onClick={() => setModal("rename")} />
          <MenuItem icon={<Icon icon={MovePageOutline} />} label="Move to" onClick={() => setModal("move")} />
          <MenuItem
            variant="danger"
            icon={<Icon icon={DeleteOutline} />}
            label="Delete"
            onClick={() => setModal("delete")}
          />
        </MenuContent>
      </Menu>
    </div>
  );

  const commonProps = {
    role: "link",
    tabIndex: 0,
    draggable: canCurrentUserCreatePage,
    onDragStart: (e: React.DragEvent) => setFolderDragItem(e, { kind: "folder", id: folder.id }),
    onClick: () => router.push(href),
    onKeyDown: (e: React.KeyboardEvent) => {
      if (e.key === "Enter") router.push(href);
    },
    ...dropTargetProps,
  };

  return (
    <>
      {layout === "grid" ? (
        <div
          {...commonProps}
          className={cn(
            "group relative flex cursor-pointer flex-col gap-3 rounded-lg border border-subtle bg-layer-1 p-4 transition-colors hover:border-strong hover:bg-layer-1-hover",
            { "border-accent-strong bg-accent-primary/10": isDragOver }
          )}
        >
          <div className="flex items-start justify-between gap-2">
            <Folder className="size-8 shrink-0 fill-current text-accent-primary/70" strokeWidth={1.25} />
            {actions}
          </div>
          <div className="min-w-0">
            <p className="truncate text-13 font-medium text-primary">{folder.name}</p>
            <p className="truncate text-11 text-tertiary">{summary}</p>
          </div>
        </div>
      ) : (
        <div
          {...commonProps}
          className={cn(
            "group flex min-h-[52px] w-full cursor-pointer items-center justify-between gap-3 border-b border-subtle bg-layer-transparent px-page-x py-3 text-13 hover:bg-layer-transparent-hover",
            { "bg-accent-primary/10 outline outline-1 -outline-offset-1 outline-accent-strong": isDragOver }
          )}
        >
          <div className="flex min-w-0 items-center gap-4">
            <Folder className="size-4 shrink-0 fill-current text-accent-primary/70" />
            <span className="truncate">{folder.name}</span>
            <span className="shrink-0 text-11 text-tertiary">{summary}</span>
          </div>
          {actions}
        </div>
      )}
      <PageFolderFormModal
        isOpen={modal === "rename"}
        onClose={() => setModal(null)}
        storeType={storeType}
        folder={folder}
      />
      <MoveToFolderModal
        isOpen={modal === "move"}
        onClose={() => setModal(null)}
        projectId={folder.project}
        storeType={storeType}
        item={{ kind: "folder", id: folder.id }}
        itemName={folder.name}
        currentFolderId={folder.parent ?? null}
      />
      <DeletePageFolderModal
        isOpen={modal === "delete"}
        onClose={() => setModal(null)}
        folder={folder}
        workspaceSlug={workspaceSlug}
        storeType={storeType}
      />
    </>
  );
});
