/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { observer } from "mobx-react";
import useSWR from "swr";
import type { TPageNavigationTabs } from "@plane/types";
// plane web hooks
import type { EPageStoreType } from "@/plane-web/hooks/store";
import { usePageStore } from "@/plane-web/hooks/store";
// local imports
import { PagesListHeaderRoot } from "./header";
import { PagesListMainContent } from "./pages-list-main-content";

type TPageView = {
  children: React.ReactNode;
  pageType: TPageNavigationTabs;
  projectId: string;
  storeType: EPageStoreType;
  workspaceSlug: string;
};

export const PagesListView = observer(function PagesListView(props: TPageView) {
  const { children, pageType, projectId, storeType, workspaceSlug } = props;
  // store hooks
  const { fetchPagesList, fetchFolders } = usePageStore(storeType);
  // fetching pages list
  useSWR(
    workspaceSlug && projectId && pageType ? `PROJECT_PAGES_${projectId}` : null,
    workspaceSlug && projectId && pageType ? () => fetchPagesList(workspaceSlug, projectId, pageType) : null
  );
  // fetching page folders
  const { isLoading: isFoldersLoading } = useSWR(
    workspaceSlug && projectId ? `PROJECT_PAGE_FOLDERS_${projectId}` : null,
    workspaceSlug && projectId ? () => fetchFolders(workspaceSlug, projectId) : null
  );

  // pages loader
  return (
    <div className="relative flex h-full w-full flex-col overflow-hidden">
      {/* tab header */}
      {/* always shown: tabs and folder controls must stay reachable in an empty project */}
      <PagesListHeaderRoot
        pageType={pageType}
        projectId={projectId}
        storeType={storeType}
        workspaceSlug={workspaceSlug}
      />
      <PagesListMainContent pageType={pageType} storeType={storeType} isFoldersLoading={isFoldersLoading}>
        {children}
      </PagesListMainContent>
    </div>
  );
});
