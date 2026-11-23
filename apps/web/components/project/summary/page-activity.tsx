/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import Link from "next/link";
import { FolderClosed, Lock } from "lucide-react";
import { PagesOutline } from "@makeplane/propel/icons";
import { Avatar } from "@makeplane/propel/components/avatar";
import { calculateTimeAgo, getFileURL } from "@plane/utils";
// services
import type { TProjectSummaryPageActivity } from "@/services/project";

type Props = {
  pages: TProjectSummaryPageActivity[];
  workspaceSlug: string;
  projectId: string;
};

export function SummaryPageActivity(props: Props) {
  const { pages, workspaceSlug, projectId } = props;
  if (pages.length === 0) return <p className="py-8 text-center text-13 text-placeholder">No pages yet.</p>;

  return (
    <ul className="vertical-scrollbar scrollbar-sm max-h-80 space-y-4 overflow-y-auto pr-1">
      {pages.map((page) => (
        <li key={page.id} className="flex items-start gap-3 text-13">
          <span className="mt-0.5 flex shrink-0">
            <Avatar
              alt={page.actor?.display_name}
              fallback={page.actor?.display_name?.[0]?.toUpperCase() ?? "?"}
              src={getFileURL(page.actor?.avatar_url ?? "")}
              size="md"
            />
          </span>
          <div className="min-w-0">
            <p className="text-secondary">
              <span className="font-medium text-primary">{page.actor?.display_name ?? "Someone"}</span> {page.verb}{" "}
              <Link
                href={`/${workspaceSlug}/projects/${projectId}/pages/${page.id}`}
                className="inline-flex items-center gap-1 font-medium text-accent-primary hover:underline"
              >
                <PagesOutline className="size-3.5 shrink-0" />
                {page.name || "Untitled"}
                {page.is_private && <Lock className="size-3 shrink-0" aria-label="Private" />}
              </Link>
            </p>
            <p className="flex items-center gap-1.5 text-11 text-tertiary">
              {calculateTimeAgo(page.at)}
              {page.folder && (
                <>
                  <span>·</span>
                  <FolderClosed className="size-3" />
                  {page.folder}
                </>
              )}
            </p>
          </div>
        </li>
      ))}
    </ul>
  );
}
