/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useState } from "react";
import { observer } from "mobx-react";
import { useParams } from "next/navigation";
import { X } from "lucide-react";
// plane imports
import { EUserPermissions, EUserPermissionsLevel } from "@plane/constants";
import { DueDateOutline } from "@makeplane/propel/icons";
import { DateSelect } from "@plane/blocks/property-select";
import { setToast } from "@plane/blocks/toast";
import type { TBulkIssueProperties } from "@plane/types";
import { cn, renderFormattedPayloadDate } from "@plane/utils";
// components
import { LabelSelect } from "@/components/dropdowns/label/label-select";
import { MemberSelect } from "@/components/dropdowns/member/member-select";
import { PrioritySelect } from "@/components/dropdowns/priority/priority-select";
import { StateSelect } from "@/components/dropdowns/state/state-select";
// hooks
import { useIssueDetail } from "@/hooks/store/use-issue-detail";
import { useUserPermissions, useUserProfile } from "@/hooks/store/user";
import { useIssuesStore } from "@/hooks/use-issue-layout-store";
import type { TSelectionHelper } from "@/hooks/use-multiple-select";

type Props = {
  className?: string;
  floating?: boolean;
  selectedIssueIds: string[];
  selectionHelpers: TSelectionHelper;
};

const renderNotice = (message: string) => <p className="text-body-xs-regular text-tertiary">{message}</p>;

export const IssueBulkOperationsToolbar = observer(function IssueBulkOperationsToolbar(props: Props) {
  const { className, floating = false, selectedIssueIds, selectionHelpers } = props;
  // router
  const { workspaceSlug } = useParams();
  // states
  const [isSubmitting, setIsSubmitting] = useState(false);
  // store hooks
  const { issues } = useIssuesStore();
  const {
    issue: { getIssueById },
  } = useIssueDetail();
  const { allowPermissions } = useUserPermissions();
  const { data: userProfile } = useUserProfile();
  // derived values
  const projectIds = new Set(selectedIssueIds.map((id) => getIssueById(id)?.project_id).filter(Boolean));
  const projectId = projectIds.size === 1 ? [...projectIds][0] : undefined;
  const canEdit =
    !!projectId &&
    allowPermissions(
      [EUserPermissions.ADMIN, EUserPermissions.MEMBER],
      EUserPermissionsLevel.PROJECT,
      workspaceSlug?.toString(),
      projectId
    );
  const count = selectedIssueIds.length;

  const handleUpdate = async (properties: Partial<TBulkIssueProperties>, summary: string) => {
    if (!workspaceSlug || !projectId || isSubmitting) return;
    setIsSubmitting(true);
    try {
      await issues.bulkUpdateProperties(workspaceSlug.toString(), projectId, {
        issue_ids: selectedIssueIds,
        properties,
      });
      setToast({
        type: "success",
        title: "Work items updated",
        message: `${summary} on ${count} work item${count === 1 ? "" : "s"}.`,
      });
    } catch (error) {
      const message = (error as { error?: string } | undefined)?.error;
      setToast({
        type: "error",
        title: "Update failed",
        message: message ?? "The work items could not be updated. Please try again.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    // floating: the table's sticky cells would otherwise paint over the bar and the menus it opens
    <div
      className={cn(
        floating
          ? "pointer-events-none fixed inset-x-0 bottom-6 z-20 flex justify-center px-4"
          : "sticky bottom-0 left-0 z-2 px-3.5 pb-3",
        className
      )}
    >
      <div
        className={cn(
          "flex flex-wrap items-center gap-2 rounded-md border border-subtle bg-surface-1 px-3 py-2 shadow-raised-200",
          floating ? "pointer-events-auto max-w-full rounded-lg border-strong" : "min-h-12 w-full"
        )}
      >
        <div className="flex items-center gap-1.5 pr-2">
          <span className="text-body-xs-medium text-primary">{count} selected</span>
          <button
            type="button"
            className="grid size-6 place-items-center rounded-sm text-tertiary hover:bg-layer-1 hover:text-primary"
            onClick={selectionHelpers.handleClearSelection}
            aria-label="Clear selection"
          >
            <X className="size-3.5" />
          </button>
        </div>
        <span className="bg-subtle h-5 w-px" />
        {!projectId ? (
          renderNotice("Select work items from a single project to change them together.")
        ) : !canEdit ? (
          renderNotice("You need member access to this project to change these work items.")
        ) : (
          <div className={cn("flex flex-wrap items-center gap-2", { "pointer-events-none opacity-60": isSubmitting })}>
            <StateSelect
              value={null}
              onChange={(stateId) => void handleUpdate({ state_id: stateId }, "State changed")}
              projectId={projectId}
              variant="pill-md"
              placeholder="State"
            />
            <PrioritySelect
              value={null}
              onChange={(priority) => void handleUpdate({ priority }, "Priority changed")}
              variant="pill-md"
              placeholder="Priority"
            />
            <MemberSelect
              value={null}
              onChange={(assigneeId) => {
                if (assigneeId) void handleUpdate({ assignee_ids: [assigneeId] }, "Assignee added");
              }}
              projectId={projectId}
              variant="pill-md"
              placeholder="Add assignee"
            />
            <LabelSelect
              value={[]}
              onChange={(labelIds) => {
                if (labelIds.length) void handleUpdate({ label_ids: labelIds }, "Label added");
              }}
              projectId={projectId}
              variant="pill-md"
              placeholder="Add label"
            />
            <DateSelect
              value={null}
              onChange={(date) =>
                void handleUpdate(
                  { target_date: date ? renderFormattedPayloadDate(date) : null },
                  date ? "Due date set" : "Due date cleared"
                )
              }
              icon={<DueDateOutline />}
              placeholder="Due date"
              weekStartsOn={userProfile?.start_of_the_week}
              variant="pill-md"
            />
          </div>
        )}
      </div>
    </div>
  );
});
