/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useState } from "react";
import { observer } from "mobx-react";
import { Copy } from "lucide-react";
import useSWR from "swr";
// plane imports
import { SITES_URL } from "@plane/constants";
import { setToast, TOAST_TYPE } from "@plane/propel/toast";
import type { TProjectPublishSettings } from "@plane/types";
import { ToggleSwitch } from "@plane/ui";
// services
import { InboxIssueService } from "@/services/inbox/inbox-issue.service";
import { ProjectPublishService } from "@/services/project/project-publish.service";

const publishService = new ProjectPublishService();
const inboxIssueService = new InboxIssueService();

type Props = {
  workspaceSlug: string;
  projectId: string;
};

/** The public URL of a published intake form, served by the Spaces app. */
const buildFormUrl = (anchor: string) => `${SITES_URL}/intake/${anchor}/`;

export const IntakeFormPublish = observer(function IntakeFormPublish(props: Props) {
  const { workspaceSlug, projectId } = props;
  const [isToggling, setIsToggling] = useState(false);

  const { data: settings, mutate } = useSWR<TProjectPublishSettings>(
    workspaceSlug && projectId ? `INTAKE_PUBLISH_${workspaceSlug}_${projectId}` : null,
    workspaceSlug && projectId ? () => publishService.fetchPublishSettings(workspaceSlug, projectId) : null
  );

  const isPublished = !!settings?.intake;
  const formUrl = settings?.anchor ? buildFormUrl(settings.anchor) : "";

  const handleToggle = async (enable: boolean) => {
    setIsToggling(true);
    try {
      let intakeId: string | null = null;
      if (enable) {
        const intakes = await inboxIssueService.fetchIntakes(workspaceSlug, projectId);
        intakeId = intakes?.[0]?.id ?? null;
        if (!intakeId) {
          setToast({
            type: TOAST_TYPE.ERROR,
            title: "Could not publish",
            message: "This project has no intake to publish. Make sure Intake is enabled.",
          });
          return;
        }
      }
      // Preserve any other publish flags already set on the project board.
      const updated = await publishService.publishProject(workspaceSlug, projectId, {
        intake: intakeId,
        is_comments_enabled: settings?.is_comments_enabled ?? false,
        is_reactions_enabled: settings?.is_reactions_enabled ?? false,
        is_votes_enabled: settings?.is_votes_enabled ?? false,
        view_props: settings?.view_props,
      });
      await mutate(updated, false);
      setToast({
        type: TOAST_TYPE.SUCCESS,
        title: enable ? "Intake form published" : "Intake form unpublished",
        message: enable
          ? "Anyone with the link can now submit work items into this project's Intake."
          : "The public intake form is no longer accessible.",
      });
    } catch {
      setToast({ type: TOAST_TYPE.ERROR, title: "Something went wrong", message: "Please try again." });
    } finally {
      setIsToggling(false);
    }
  };

  const handleCopy = () => {
    if (!formUrl) return;
    navigator.clipboard.writeText(formUrl);
    setToast({ type: TOAST_TYPE.SUCCESS, title: "Link copied", message: "Intake form link copied to clipboard." });
  };

  return (
    <div className="mt-7 border-t border-subtle pt-7">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h4 className="text-sm font-medium text-primary">Intake form</h4>
          <p className="mt-1 text-sm text-secondary">
            Publish a public web form so people without a workspace account can submit work items straight into this
            project&apos;s Intake.
          </p>
        </div>
        <ToggleSwitch value={isPublished} onChange={handleToggle} disabled={isToggling} />
      </div>

      {isPublished && formUrl && (
        <div className="mt-4 flex items-center gap-2 rounded-md border border-subtle bg-surface-2 p-2">
          <span className="flex-1 truncate px-1 text-sm text-secondary">{formUrl}</span>
          <button
            type="button"
            onClick={handleCopy}
            className="flex items-center gap-1.5 rounded px-2 py-1 text-xs font-medium text-secondary hover:bg-surface-3"
          >
            <Copy className="size-3.5" />
            Copy link
          </button>
        </div>
      )}
    </div>
  );
});
