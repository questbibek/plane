/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { FormEvent } from "react";
import { useEffect, useState } from "react";
import { observer } from "mobx-react";
import { Button } from "@plane/propel/button";
import { TOAST_TYPE, setToast } from "@plane/propel/toast";
import type { TPageFolder } from "@plane/types";
import { EModalPosition, EModalWidth, Input, ModalCore } from "@plane/ui";
// plane web hooks
import type { EPageStoreType } from "@/plane-web/hooks/store";
import { usePageStore } from "@/plane-web/hooks/store";

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
        type: TOAST_TYPE.ERROR,
        title: "Error!",
        message: message ?? `Folder could not be ${folder ? "renamed" : "created"}. Please try again.`,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ModalCore isOpen={isOpen} handleClose={onClose} position={EModalPosition.TOP} width={EModalWidth.LG}>
      <form onSubmit={handleSubmit}>
        <div className="space-y-5 p-5">
          <h3 className="text-18 font-medium text-secondary">{folder ? "Rename folder" : "New folder"}</h3>
          <Input
            id="folder-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Folder name"
            className="w-full text-14"
            maxLength={255}
            required
            // eslint-disable-next-line jsx-a11y/no-autofocus
            autoFocus
          />
        </div>
        <div className="flex items-center justify-end gap-2 border-t-[0.5px] border-subtle px-5 py-4">
          <Button variant="secondary" size="lg" type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" size="lg" type="submit" loading={isSubmitting} disabled={!name.trim()}>
            {folder ? "Save" : "Create folder"}
          </Button>
        </div>
      </form>
    </ModalCore>
  );
});
