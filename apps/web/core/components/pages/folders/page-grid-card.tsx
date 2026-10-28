/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useRef } from "react";
import { observer } from "mobx-react";
import Link from "next/link";
import { Earth, FolderInput } from "lucide-react";
import { Logo } from "@plane/propel/emoji-icon-picker";
import { LockIcon, PageIcon } from "@plane/propel/icons";
import { getPageName, renderFormattedDate } from "@plane/utils";
// plane web hooks
import type { EPageStoreType } from "@/plane-web/hooks/store";
import { usePage } from "@/plane-web/hooks/store";
// local imports
import { PageActions } from "../dropdowns";
import { PAGE_LIST_ACTIONS_ORDER } from "../list/block-item-action";
import { PageTags } from "../tags/page-tags";

type Props = {
  pageId: string;
  storeType: EPageStoreType;
  onMoveToFolder: () => void;
  folderPath?: string;
};

export const PageGridCard = observer(function PageGridCard(props: Props) {
  const { pageId, storeType, onMoveToFolder, folderPath } = props;
  // refs
  const parentRef = useRef<HTMLDivElement>(null);
  // store hooks
  const page = usePage({ pageId, storeType });
  if (!page) return null;
  // derived values
  const { name, logo_props, access, updated_at, project_ids, getRedirectionLink, canCurrentUserEditPage } = page;

  return (
    <div
      ref={parentRef}
      className="group relative flex flex-col gap-3 rounded-lg border border-subtle bg-layer-1 p-4 transition-colors hover:border-strong hover:bg-layer-1-hover"
    >
      <Link href={getRedirectionLink()} className="absolute inset-0 rounded-lg" aria-label={getPageName(name)} />
      <div className="pointer-events-none flex items-start justify-between gap-2">
        <span className="grid size-8 place-items-center rounded-md bg-layer-2">
          {logo_props?.in_use ? (
            <Logo logo={logo_props} size={18} type="lucide" />
          ) : (
            <PageIcon className="size-4 text-tertiary" />
          )}
        </span>
        <div className="pointer-events-auto relative">
          <PageActions
            optionsOrder={PAGE_LIST_ACTIONS_ORDER}
            extraOptions={[
              {
                key: "move-to-folder",
                action: onMoveToFolder,
                title: "Move to folder",
                icon: FolderInput,
                shouldRender: canCurrentUserEditPage,
              },
            ]}
            page={page}
            parentRef={parentRef}
            storeType={storeType}
          />
        </div>
      </div>
      <div className="pointer-events-none min-w-0">
        <p className="truncate text-13 font-medium text-primary">{getPageName(name)}</p>
        <p className="flex items-center gap-1.5 truncate text-11 text-tertiary">
          {access === 0 ? <Earth className="size-3 shrink-0" /> : <LockIcon className="size-3 shrink-0" />}
          <span className="truncate">{folderPath ?? `Edited ${renderFormattedDate(updated_at)}`}</span>
        </p>
      </div>
      <PageTags page={page} projectId={project_ids?.[0] ?? ""} storeType={storeType} className="relative flex-wrap" />
    </div>
  );
});
