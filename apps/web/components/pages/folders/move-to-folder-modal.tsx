/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useEffect, useMemo, useState } from "react";
import { observer } from "mobx-react";
import { Folder, FolderOpen, Home } from "lucide-react";
import { Button } from "@makeplane/propel/components/button";
import { setToast } from "@plane/blocks/toast";
import type { TPageFolder } from "@plane/types";
import {
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogHeader,
  DialogHeading,
  DialogMain,
  DialogTitle,
} from "@makeplane/propel/components/dialog";
import { cn } from "@plane/utils";
// plane web hooks
import type { EPageStoreType } from "@/hooks/store";
import { usePageStore } from "@/hooks/store";
// local imports
import type { TFolderDragItem } from "./helpers";

type Props = {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  storeType: EPageStoreType;
  item: TFolderDragItem;
  itemName: string;
  currentFolderId: string | null;
};

type TFolderRow = { folder: TPageFolder; depth: number };

export const MoveToFolderModal = observer(function MoveToFolderModal(props: Props) {
  const { isOpen, onClose, projectId, storeType, item, itemName, currentFolderId } = props;
  // states
  const [targetId, setTargetId] = useState<string | null>(currentFolderId);
  const [isSubmitting, setIsSubmitting] = useState(false);
  // store hooks
  const { getChildFolders, movePageToFolder, updateFolder } = usePageStore(storeType);

  useEffect(() => {
    if (isOpen) setTargetId(currentFolderId);
  }, [isOpen, currentFolderId]);

  // depth-first folder tree; a moved folder's own subtree is left out since it cannot be a target
  const rows = useMemo(() => {
    const result: TFolderRow[] = [];
    const walk = (parentId: string | null, depth: number) => {
      getChildFolders(projectId, parentId).forEach((folder) => {
        if (item.kind === "folder" && folder.id === item.id) return;
        result.push({ folder, depth });
        walk(folder.id, depth + 1);
      });
    };
    walk(null, 0);
    return result;
  }, [getChildFolders, projectId, item]);

  const handleMove = async () => {
    setIsSubmitting(true);
    try {
      if (item.kind === "page") await movePageToFolder(item.id, targetId);
      else await updateFolder(item.id, { parent: targetId });
      setToast({ type: "success", title: "Success!", message: `Moved "${itemName}".` });
      onClose();
    } catch (error) {
      const message = (error as { error?: string } | undefined)?.error;
      setToast({ type: "error", title: "Error!", message: message ?? "Could not move. Please try again." });
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderRow = (id: string | null, label: string, depth: number) => {
    const isSelected = targetId === id;
    const Icon = id === null ? Home : isSelected ? FolderOpen : Folder;
    return (
      <button
        key={id ?? "root"}
        type="button"
        onClick={() => setTargetId(id)}
        className={cn(
          "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-13 text-secondary hover:bg-layer-transparent-hover",
          { "bg-accent-primary/10 text-accent-primary hover:bg-accent-primary/10": isSelected }
        )}
        style={{ paddingLeft: `${8 + depth * 16}px` }}
      >
        <Icon className="size-4 shrink-0" />
        <span className="truncate">{label}</span>
        {id === currentFolderId && <span className="ml-auto shrink-0 text-11 text-tertiary">Current</span>}
      </button>
    );
  };

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent size="md">
        <DialogMain>
          <DialogHeader>
            <DialogHeading>
              <DialogTitle>Move &quot;{itemName}&quot;</DialogTitle>
            </DialogHeading>
          </DialogHeader>
          <DialogBody>
            <div className="space-y-0.5">
              {renderRow(null, "Pages (no folder)", 0)}
              {rows.map(({ folder, depth }) => renderRow(folder.id, folder.name, depth + 1))}
            </div>
          </DialogBody>
        </DialogMain>
        <DialogActions>
          <Button variant="secondary" size="md" stretch="auto" onClick={onClose} label="Cancel" />
          <Button
            variant="primary"
            size="md"
            stretch="auto"
            onClick={handleMove}
            loading={isSubmitting}
            disabled={targetId === currentFolderId}
            label="Move here"
          />
        </DialogActions>
      </DialogContent>
    </Dialog>
  );
});
