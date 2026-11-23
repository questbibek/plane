/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { FormEvent } from "react";
import { useEffect, useState } from "react";
import { observer } from "mobx-react";
import { Button } from "@makeplane/propel/components/button";
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
import { InputField } from "@makeplane/propel/components/input-field";
import { setToast } from "@plane/blocks/toast";
import type { TPageFolder } from "@plane/types";
// plane web hooks
import type { EPageStoreType } from "@/hooks/store";
import { usePageStore } from "@/hooks/store";

type Props = {
  isOpen: boolean;
  onClose: () => void;
  storeType: EPageStoreType;
  // rename when a folder is given, otherwise create inside parentId
  folder?: TPageFolder;
  parentId?: string | null;
};

export const PageFolderFormModal = observer(function PageFolderFormModal(props: Props) {
  const { isOpen, onClose, storeType, folder, parentId = null } = props;
  // states
  const [name, setName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  // store hooks
  const { createFolder, updateFolder } = usePageStore(storeType);

  useEffect(() => {
    if (isOpen) setName(folder?.name ?? "");
  }, [isOpen, folder?.name]);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) return;
    setIsSubmitting(true);
    try {
      if (folder) await updateFolder(folder.id, { name: trimmedName });
      else await createFolder({ name: trimmedName, parent: parentId });
      onClose();
    } catch (error) {
      const message = (error as { error?: string } | undefined)?.error;
      setToast({
        type: "error",
        title: "Error!",
        message: message ?? `Folder could not be ${folder ? "renamed" : "created"}. Please try again.`,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent size="md">
        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <DialogMain>
            <DialogHeader>
              <DialogHeading>
                <DialogTitle>{folder ? "Rename folder" : "New folder"}</DialogTitle>
              </DialogHeading>
            </DialogHeader>
            <DialogBody>
              <InputField
                id="folder-name"
                type="text"
                size="lg"
                orientation="vertical"
                label="Folder name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Folder name"
                maxLength={255}
                required
                // eslint-disable-next-line jsx-a11y/no-autofocus
                autoFocus
              />
            </DialogBody>
          </DialogMain>
          <DialogActions>
            <Button variant="secondary" size="md" stretch="auto" type="button" onClick={onClose} label="Cancel" />
            <Button
              variant="primary"
              size="md"
              stretch="auto"
              type="submit"
              loading={isSubmitting}
              disabled={!name.trim()}
              label={folder ? "Save" : "Create folder"}
            />
          </DialogActions>
        </form>
      </DialogContent>
    </Dialog>
  );
});
