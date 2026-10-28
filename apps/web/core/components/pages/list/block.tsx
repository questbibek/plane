/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useRef } from "react";
import { observer } from "mobx-react";
import { Folder } from "lucide-react";
import { Logo } from "@plane/propel/emoji-icon-picker";
import { PageIcon } from "@plane/propel/icons";
// plane imports
import { getPageName } from "@plane/utils";
// components
import { ListItem } from "@/components/core/list";
import { BlockItemAction } from "@/components/pages/list/block-item-action";
// hooks
import { usePlatformOS } from "@/hooks/use-platform-os";
// plane web hooks
import type { EPageStoreType } from "@/plane-web/hooks/store";
import { usePage } from "@/plane-web/hooks/store";

type TPageListBlock = {
  pageId: string;
  storeType: EPageStoreType;
  onMoveToFolder?: () => void;
  // shown next to the title in flat (search) results so the page's location is visible
  folderPath?: string;
};

export const PageListBlock = observer(function PageListBlock(props: TPageListBlock) {
  const { pageId, storeType, onMoveToFolder, folderPath } = props;
  // refs
  const parentRef = useRef(null);
  // hooks
  const page = usePage({
    pageId,
    storeType,
  });
  const { isMobile } = usePlatformOS();
  // handle page check
  if (!page) return null;
  // derived values
  const { name, logo_props, getRedirectionLink } = page;

  return (
    <ListItem
      prependTitleElement={
        <>
          {logo_props?.in_use ? (
            <Logo logo={logo_props} size={16} type="lucide" />
          ) : (
            <PageIcon className="h-4 w-4 text-tertiary" />
          )}
        </>
      }
      title={getPageName(name)}
      appendTitleElement={
        folderPath ? (
          <span className="flex items-center gap-1 text-11 text-tertiary">
            <Folder className="size-3" />
            {folderPath}
          </span>
        ) : undefined
      }
      itemLink={getRedirectionLink()}
      actionableItems={
        <BlockItemAction page={page} parentRef={parentRef} storeType={storeType} onMoveToFolder={onMoveToFolder} />
      }
      isMobile={isMobile}
      parentRef={parentRef}
    />
  );
});
