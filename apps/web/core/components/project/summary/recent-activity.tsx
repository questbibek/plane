/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import Link from "next/link";
import { Avatar } from "@plane/ui";
import { calculateTimeAgo, generateWorkItemLink, getFileURL } from "@plane/utils";
// services
import type { TProjectSummaryActivity } from "@/services/project";

// fields whose raw values are ids or markup: name the change, not the value
const FIELDS_WITHOUT_VALUE = new Set(["description", "parent", "attachment", "link", "relates_to", "blocked_by"]);

const describe = (entry: TProjectSummaryActivity): string => {
  const { verb, field, new_value: value } = entry;
  if (verb === "created" && (!field || field === "issue")) return "created";
  if (field === "comment") return verb === "created" ? "commented on" : `${verb} a comment on`;
  if (field === "state") return `moved to ${value ?? "a new state"}`;
  if (field === "priority") return `set priority to ${value ?? "none"}`;
  if (field === "assignees") return value ? `assigned ${value} to` : "changed assignees on";
  if (field === "labels") return value ? `added label ${value} to` : "removed a label from";
  if (field === "name") return "renamed";
  if (field === "target_date") return value ? `set the due date to ${value} on` : "removed the due date from";
  if (field === "archived_at") return value ? "archived" : "restored";
  if (field && (FIELDS_WITHOUT_VALUE.has(field) || !value)) return `updated ${field.replace(/_/g, " ")} on`;
  if (field) return `set ${field.replace(/_/g, " ")} to ${value} on`;
  return verb;
};

type Props = {
  activity: TProjectSummaryActivity[];
  workspaceSlug: string;
  projectId: string;
  identifier: string;
};

export function SummaryRecentActivity(props: Props) {
  const { activity, workspaceSlug, projectId, identifier } = props;
  if (activity.length === 0) return <p className="py-8 text-center text-13 text-placeholder">No activity yet.</p>;

  return (
    <ul className="vertical-scrollbar scrollbar-sm max-h-80 space-y-4 overflow-y-auto pr-1">
      {activity.map((entry) => (
        <li key={entry.id} className="flex items-start gap-3 text-13">
          <Avatar
            name={entry.actor?.display_name ?? "?"}
            src={getFileURL(entry.actor?.avatar_url ?? "")}
            size="md"
            className="mt-0.5 shrink-0"
          />
          <div className="min-w-0">
            <p className="text-secondary">
              <span className="font-medium text-primary">{entry.actor?.display_name ?? "Someone"}</span>{" "}
              {describe(entry)}{" "}
              {entry.issue && (
                <Link
                  href={generateWorkItemLink({
                    workspaceSlug,
                    projectId,
                    issueId: entry.issue.id,
                    projectIdentifier: identifier,
                    sequenceId: entry.issue.sequence_id,
                  })}
                  className="font-medium text-accent-primary hover:underline"
                >
                  {identifier}-{entry.issue.sequence_id}: {entry.issue.name}
                </Link>
              )}
            </p>
            <p className="text-11 text-tertiary">{calculateTimeAgo(entry.created_at)}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}
