/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useEffect, useState } from "react";
import { observer } from "mobx-react";
import { AlertTriangle } from "lucide-react";
// plane internal packages
import { Button } from "@plane/propel/button";
import { TOAST_TYPE, setToast } from "@plane/propel/toast";
import type { IWorkspace } from "@plane/types";
import { EModalPosition, EModalWidth, Input, ModalCore } from "@plane/ui";
// hooks
import { useWorkspace } from "@/hooks/store";

type Props = {
  isOpen: boolean;
  onClose: () => void;
  workspace: IWorkspace;
};

export const DeleteWorkspaceModal = observer(function DeleteWorkspaceModal(props: Props) {
  const { isOpen, onClose, workspace } = props;
  // states
  const [confirmSlug, setConfirmSlug] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  // store hooks
  const { deleteWorkspace } = useWorkspace();
  // derived values
  const canDelete = confirmSlug === workspace.slug && !isDeleting;

  useEffect(() => {
    if (isOpen) setConfirmSlug("");
  }, [isOpen]);

  const handleDelete = async () => {
    if (!canDelete) return;
    setIsDeleting(true);
    try {
      await deleteWorkspace(workspace.id, confirmSlug);
      setToast({ type: TOAST_TYPE.SUCCESS, title: "Workspace deleted", message: `${workspace.name} was deleted.` });
      onClose();
    } catch (error) {
      const message = (error as { error?: string } | undefined)?.error;
      setToast({
        type: TOAST_TYPE.ERROR,
        title: "Error",
        message: message ?? "The workspace could not be deleted. Please try again.",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <ModalCore isOpen={isOpen} handleClose={onClose} position={EModalPosition.CENTER} width={EModalWidth.XL}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void handleDelete();
        }}
      >
        <div className="space-y-4 p-5">
          <div className="flex items-start gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-full bg-danger-subtle text-danger-primary">
              <AlertTriangle className="size-5" />
            </span>
            <div className="space-y-1">
              <h3 className="text-16 font-medium">Delete workspace {workspace.name}?</h3>
              <p className="text-13 text-secondary">
                All of its{" "}
                <span className="font-medium text-danger-primary">
                  {workspace.total_projects ?? 0} project{workspace.total_projects === 1 ? "" : "s"}
                </span>
                , work items, pages and settings will be deleted, and its{" "}
                <span className="font-medium text-danger-primary">
                  {workspace.total_members ?? 0} member{workspace.total_members === 1 ? "" : "s"}
                </span>{" "}
                lose access immediately. The slug <code className="text-primary">{workspace.slug}</code> becomes free to
                reuse.
              </p>
            </div>
          </div>
          <div className="space-y-1.5">
            <label htmlFor="confirm-workspace-slug" className="text-13 text-secondary">
              Type <span className="font-medium text-primary">{workspace.slug}</span> to confirm
            </label>
            <Input
              id="confirm-workspace-slug"
              value={confirmSlug}
              onChange={(e) => setConfirmSlug(e.target.value)}
              placeholder={workspace.slug}
              className="w-full"
              autoComplete="off"
            />
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 border-t-[0.5px] border-subtle px-5 py-4">
          <Button variant="secondary" size="lg" type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="error-fill" size="lg" type="submit" disabled={!canDelete} loading={isDeleting}>
            Delete workspace
          </Button>
        </div>
      </form>
    </ModalCore>
  );
});
