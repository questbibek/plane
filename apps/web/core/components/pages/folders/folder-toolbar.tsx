/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { Fragment, useState } from "react";
import { observer } from "mobx-react";
import Link from "next/link";
import { ChevronRight, FolderPlus, LayoutGrid, List, Tags } from "lucide-react";
import { Button } from "@plane/propel/button";
import { Tooltip } from "@plane/propel/tooltip";
import type { TPageFolder, TPageListLayout, TPageNavigationTabs } from "@plane/types";
import { cn } from "@plane/utils";
// plane web hooks
import type { EPageStoreType } from "@/plane-web/hooks/store";
import { usePageStore } from "@/plane-web/hooks/store";
// local imports
import { ManagePageTagsModal } from "../tags/manage-tags-modal";
import { PageFolderFormModal } from "./folder-form-modal";
import { getPagesFolderHref } from "./helpers";
import { useFolderDropTarget } from "./use-folder-drop-target";

type Props = {
  workspaceSlug: string;
  projectId: string;
  pageType: TPageNavigationTabs;
  storeType: EPageStoreType;
  currentFolderId: string | null;
  // folders are hidden while searching or in the archive, so only the layout toggle shows
  showFolders: boolean;
};

const BreadcrumbSegment = observer(function BreadcrumbSegment(props: {
  folder: TPageFolder | null;
  href: string;
  isLast: boolean;
  storeType: EPageStoreType;
  canDrop: boolean;
}) {
  const { folder, href, isLast, storeType, canDrop } = props;
  const { isDragOver, dropTargetProps } = useFolderDropTarget(folder?.id ?? null, storeType, !canDrop || isLast);

  return (
    <Link
      href={href}
      {...dropTargetProps}
      className={cn("truncate rounded px-1.5 py-0.5 hover:bg-layer-transparent-hover", {
        "font-medium text-primary": isLast,
        "text-tertiary": !isLast,
        "bg-accent-primary/10 text-accent-primary": isDragOver,
      })}
    >
      {folder?.name ?? "All pages"}
    </Link>
  );
});

const LAYOUTS: { key: TPageListLayout; label: string; icon: typeof List }[] = [
  { key: "list", label: "List view", icon: List },
  { key: "grid", label: "Grid view", icon: LayoutGrid },
];

export const PageFolderToolbar = observer(function PageFolderToolbar(props: Props) {
  const { workspaceSlug, projectId, pageType, storeType, currentFolderId, showFolders } = props;
  // states
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isManageTagsOpen, setIsManageTagsOpen] = useState(false);
  // store hooks
  const { canCurrentUserCreatePage, getFolderPath, layout, setLayout } = usePageStore(storeType);
  // derived values
  const path = getFolderPath(currentFolderId);
  const segments: (TPageFolder | null)[] = [null, ...path];

  return (
    <div className="flex min-h-11 shrink-0 items-center justify-between gap-3 border-b border-subtle px-page-x py-1.5">
      <nav className="flex min-w-0 items-center gap-0.5 text-13" aria-label="Folder path">
        {showFolders &&
          segments.map((folder, index) => (
            <Fragment key={folder?.id ?? "root"}>
              {index > 0 && <ChevronRight className="size-3.5 shrink-0 text-placeholder" />}
              <BreadcrumbSegment
                folder={folder}
                href={getPagesFolderHref(workspaceSlug, projectId, pageType, folder?.id ?? null)}
                isLast={index === segments.length - 1}
                storeType={storeType}
                canDrop={canCurrentUserCreatePage}
              />
            </Fragment>
          ))}
      </nav>
      <div className="flex shrink-0 items-center gap-2">
        <Button variant="secondary" size="sm" onClick={() => setIsManageTagsOpen(true)}>
          <Tags className="size-3.5" />
          Manage tags
        </Button>
        {showFolders && canCurrentUserCreatePage && (
          <Button variant="secondary" size="sm" onClick={() => setIsCreateOpen(true)}>
            <FolderPlus className="size-3.5" />
            New folder
          </Button>
        )}
        <div className="flex items-center gap-0.5 rounded-md border border-subtle p-0.5">
          {LAYOUTS.map(({ key, label, icon: Icon }) => (
            <Tooltip key={key} tooltipContent={label}>
              <button
                type="button"
                aria-label={label}
                aria-pressed={layout === key}
                onClick={() => setLayout(key)}
                className={cn("grid size-6 place-items-center rounded text-tertiary hover:text-secondary", {
                  "bg-layer-2 text-primary": layout === key,
                })}
              >
                <Icon className="size-3.5" />
              </button>
            </Tooltip>
          ))}
        </div>
      </div>
      <ManagePageTagsModal
        isOpen={isManageTagsOpen}
        onClose={() => setIsManageTagsOpen(false)}
        workspaceSlug={workspaceSlug}
        projectId={projectId}
        storeType={storeType}
      />
      <PageFolderFormModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        storeType={storeType}
        parentId={currentFolderId}
      />
    </div>
  );
});
