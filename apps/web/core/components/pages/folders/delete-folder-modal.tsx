/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useEffect, useState } from "react";
import { observer } from "mobx-react";
import { TOAST_TYPE, setToast } from "@plane/propel/toast";
import type { TPageFolder, TPageFolderDeletionScope } from "@plane/types";
import { AlertModalCore } from "@plane/ui";
// plane web hooks
import type { EPageStoreType } from "@/plane-web/hooks/store";
import { usePageStore } from "@/plane-web/hooks/store";
// services
import { ProjectPageFolderService } from "@/services/page";

const folderService = new ProjectPageFolderService();

type Props = {
  isOpen: boolean;
  onClose: () => void;
  onDeleted?: () => void;
  folder: TPageFolder;
  workspaceSlug: string;
  storeType: EPageStoreType;
};

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? "" : "s"}`;

export const DeletePageFolderModal = observer(function DeletePageFolderModal(props: Props) {
  const { isOpen, onClose, onDeleted, folder, workspaceSlug, storeType } = props;
  // states
  const [scope, setScope] = useState<TPageFolderDeletionScope | undefined>();
  const [isDeleting, setIsDeleting] = useState(false);
  // store hooks
  const { deleteFolder } = usePageStore(storeType);

  // ask the server what is inside: it also counts pages in sub folders and archived pages
  useEffect(() => {
    if (!isOpen) return;
    setScope(undefined);
    folderService
      .fetchDeletionScope(workspaceSlug, folder.project, folder.id)
      .then((res) => setScope(res.deletion_scope))
      .catch(() => setScope(undefined));
  }, [isOpen, workspaceSlug, folder.project, folder.id]);

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await deleteFolder(folder.id);
      setToast({ type: TOAST_TYPE.SUCCESS, title: "Success!", message: "Folder deleted successfully." });
      onClose();
      onDeleted?.();
    } catch (error) {
      const message = (error as { error?: string } | undefined)?.error;
      setToast({
        type: TOAST_TYPE.ERROR,
        title: "Error!",
        message: message ?? "Folder could not be deleted. Please try again.",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const isEmpty = scope && scope.page_count === 0 && scope.folder_count === 0;

  return (
    <AlertModalCore
      handleClose={onClose}
      handleSubmit={handleDelete}
      isSubmitting={isDeleting}
      isOpen={isOpen}
      title="Delete folder"
      content={
        <>
          Are you sure you want to delete the folder{" "}
          <span className="font-medium break-words break-all text-primary">{folder.name}</span>?{" "}
          {!scope ? (
            "Checking what is inside..."
          ) : isEmpty ? (
            "The folder is empty."
          ) : (
            <>
              <span className="font-medium text-danger-primary">
                {[
                  scope.page_count > 0 && plural(scope.page_count, "page"),
                  scope.folder_count > 0 && plural(scope.folder_count, "sub folder"),
                ]
                  .filter(Boolean)
                  .join(" and ")}{" "}
                inside it will be permanently deleted
              </span>
              {scope.others_page_count > 0 && <> ({plural(scope.others_page_count, "page")} owned by other members)</>}.
            </>
          )}{" "}
          This action cannot be undone.
        </>
      }
    />
  );
});
