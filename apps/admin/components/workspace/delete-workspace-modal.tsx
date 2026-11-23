/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { observer } from "mobx-react";
// plane internal packages
import { TypeToConfirmDialog } from "@plane/blocks/dialog";
import { setToast } from "@plane/blocks/toast";
import type { IWorkspace } from "@plane/types";
// hooks
import { useWorkspace } from "@/hooks/store";

type Props = {
  isOpen: boolean;
  onClose: () => void;
  workspace: IWorkspace;
};

export const DeleteWorkspaceModal = observer(function DeleteWorkspaceModal(props: Props) {
  const { isOpen, onClose, workspace } = props;
  // store hooks
  const { deleteWorkspace } = useWorkspace();

  // the dialog only enables confirm once the slug has been typed exactly
  const handleDelete = async () => {
    try {
      await deleteWorkspace(workspace.id, workspace.slug);
      setToast({ type: "success", title: "Workspace deleted", message: `${workspace.name} was deleted.` });
      onClose();
    } catch (error) {
      const message = (error as { error?: string } | undefined)?.error;
      setToast({
        type: "error",
        title: "Error",
        message: message ?? "The workspace could not be deleted. Please try again.",
      });
    }
  };

  const projectCount = workspace.total_projects ?? 0;
  const memberCount = workspace.total_members ?? 0;

  return (
    <TypeToConfirmDialog
      isOpen={isOpen}
      onClose={onClose}
      onConfirm={handleDelete}
      title={`Delete workspace ${workspace.name}?`}
      description={
        <>
          All of its{" "}
          <span className="font-medium text-danger-primary">
            {projectCount} project{projectCount === 1 ? "" : "s"}
          </span>
          , work items, pages and settings will be deleted, and its{" "}
          <span className="font-medium text-danger-primary">
            {memberCount} member{memberCount === 1 ? "" : "s"}
          </span>{" "}
          lose access immediately. The slug <code className="text-primary">{workspace.slug}</code> becomes free to
          reuse.
        </>
      }
      fields={[
        {
          name: "confirm-workspace-slug",
          label: `Type ${workspace.slug} to confirm`,
          expectedValue: workspace.slug,
        },
      ]}
      confirmLabel="Delete workspace"
      loadingLabel="Deleting..."
    />
  );
});
