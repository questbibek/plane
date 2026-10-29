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
import { LabelPropertyIcon } from "@plane/propel/icons";
import { TOAST_TYPE, setToast } from "@plane/propel/toast";
import type { TBulkIssueProperties } from "@plane/types";
import { cn, renderFormattedPayloadDate } from "@plane/utils";
// components
import { DateDropdown } from "@/components/dropdowns/date";
import { MemberDropdown } from "@/components/dropdowns/member/dropdown";
import { PriorityDropdown } from "@/components/dropdowns/priority";
import { StateDropdown } from "@/components/dropdowns/state/dropdown";
import { IssueLabelSelect } from "@/components/issues/select";
// hooks
import { useIssueDetail } from "@/hooks/store/use-issue-detail";
import { useUserPermissions } from "@/hooks/store/user";
import { useIssuesStore } from "@/hooks/use-issue-layout-store";
import type { TSelectionHelper } from "@/hooks/use-multiple-select";

type Props = {
  className?: string;
  floating?: boolean;
  selectedIssueIds: string[];
  selectionHelpers: TSelectionHelper;
};

const renderNotice = (message: string) => <p className="text-13 text-tertiary">{message}</p>;

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
        type: TOAST_TYPE.SUCCESS,
        title: "Work items updated",
        message: `${summary} on ${count} work item${count === 1 ? "" : "s"}.`,
      });
    } catch (error) {
      const message = (error as { error?: string } | undefined)?.error;
      setToast({
        type: TOAST_TYPE.ERROR,
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
          <span className="text-13 font-medium text-primary">{count} selected</span>
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
            <div className="h-7">
              <StateDropdown
                value={null}
                onChange={(stateId) => void handleUpdate({ state_id: stateId }, "State changed")}
                projectId={projectId}
                buttonVariant="border-with-text"
                placement="top-start"
                placeholder="State"
                showDefaultState={false}
              />
            </div>
            <div className="h-7">
              <PriorityDropdown
                value={null}
                onChange={(priority) => void handleUpdate({ priority }, "Priority changed")}
                buttonVariant="border-with-text"
                placement="top-start"
                placeholder="Priority"
              />
            </div>
            <div className="h-7">
              <MemberDropdown
                value={null}
                multiple={false}
                onChange={(assigneeId) => {
                  if (assigneeId) void handleUpdate({ assignee_ids: [assigneeId] }, "Assignee added");
                }}
                projectId={projectId}
                buttonVariant="border-with-text"
                placement="top-start"
                placeholder="Add assignee"
              />
            </div>
            <div className="h-7">
              <IssueLabelSelect
                value={[]}
                onChange={(labelIds) => {
                  if (labelIds.length) void handleUpdate({ label_ids: labelIds }, "Label added");
                }}
                projectId={projectId}
                placement="top-start"
                label={
                  <span className="flex h-full items-center gap-1 rounded-sm border-[0.5px] border-strong px-2 text-11 hover:bg-layer-1">
                    <LabelPropertyIcon className="size-3 shrink-0" />
                    Add label
                  </span>
                }
              />
            </div>
            <div className="h-7">
              <DateDropdown
                value={null}
                onChange={(date) =>
                  void handleUpdate(
                    { target_date: date ? renderFormattedPayloadDate(date) : null },
                    date ? "Due date set" : "Due date cleared"
                  )
                }
                buttonVariant="border-with-text"
                placement="top-start"
                placeholder="Due date"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
});
