/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useCallback, useEffect, useState } from "react";
import { observer } from "mobx-react";
import { Pencil } from "lucide-react";
import { Button } from "@makeplane/propel/components/button";
import { SearchOutline, DeleteOutline } from "@makeplane/propel/icons";
import { setToast } from "@plane/blocks/toast";
import type { TPageTagSummary } from "@plane/types";
import {
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogHeading,
  DialogMain,
  DialogTitle,
} from "@makeplane/propel/components/dialog";
import { Loader } from "@plane/blocks/skeleton";
// plane web hooks
import type { EPageStoreType } from "@/hooks/store";
import { usePageStore } from "@/hooks/store";
// services
import { ProjectPageService } from "@/services/page";
// local imports
import { PageTagChip } from "./tag-chip";

const pageService = new ProjectPageService();

type Props = {
  isOpen: boolean;
  onClose: () => void;
  workspaceSlug: string;
  projectId: string;
  storeType: EPageStoreType;
};

type TRowMode = { tag: string; mode: "rename" | "delete" } | null;

const plural = (count: number) => `${count} page${count === 1 ? "" : "s"}`;

export const ManagePageTagsModal = observer(function ManagePageTagsModal(props: Props) {
  const { isOpen, onClose, workspaceSlug, projectId, storeType } = props;
  // states
  const [tags, setTags] = useState<TPageTagSummary[] | undefined>();
  const [query, setQuery] = useState("");
  const [active, setActive] = useState<TRowMode>(null);
  const [draftName, setDraftName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  // store hooks
  const { canCurrentUserCreatePage, renameProjectTag, deleteProjectTag } = usePageStore(storeType);

  const loadTags = useCallback(() => {
    pageService
      .fetchTags(workspaceSlug, projectId)
      .then(setTags)
      .catch(() => setTags([]));
  }, [workspaceSlug, projectId]);

  useEffect(() => {
    if (!isOpen) return;
    setTags(undefined);
    setQuery("");
    setActive(null);
    loadTags();
  }, [isOpen, loadTags]);

  const startRename = (tag: string) => {
    setDraftName(tag);
    setActive({ tag, mode: "rename" });
  };

  const run = async (action: () => Promise<number>, verb: string) => {
    setIsSubmitting(true);
    try {
      const count = await action();
      setToast({ type: "success", title: "Success!", message: `Tag ${verb} on ${plural(count)}.` });
      setActive(null);
      loadTags();
    } catch (error) {
      const message = (error as { error?: string } | undefined)?.error;
      setToast({ type: "error", title: "Error!", message: message ?? `Tag could not be ${verb}.` });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRename = (tag: string) => {
    const newName = draftName.trim().replace(/\s+/g, " ");
    if (!newName || newName === tag) {
      setActive(null);
      return;
    }
    void run(() => renameProjectTag(tag, newName), "renamed");
  };

  const visibleTags = (tags ?? []).filter((tag) => tag.name.toLowerCase().includes(query.trim().toLowerCase()));
  const existingNames = new Set((tags ?? []).map((tag) => tag.name.toLowerCase()));

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent size="lg">
        <DialogMain>
          <DialogHeader>
            <DialogHeading>
              <DialogTitle>Manage tags</DialogTitle>
              <DialogDescription>
                Rename or delete a tag on every page in this project. Renaming onto an existing tag merges them.
              </DialogDescription>
            </DialogHeading>
          </DialogHeader>
          <DialogBody>
            <div className="space-y-4">
              <div className="flex items-center gap-1.5 rounded-sm border border-subtle bg-surface-2 px-2 py-1">
                <SearchOutline className="text-placeholder" width={12} height={12} strokeWidth={2} />
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search tags"
                  className="w-full bg-transparent text-12 outline-none placeholder:text-placeholder"
                />
              </div>
              <div className="vertical-scrollbar scrollbar-sm max-h-96 overflow-y-auto">
                {!tags ? (
                  <Loader className="space-y-2">
                    <Loader.Item height="32px" />
                    <Loader.Item height="32px" />
                    <Loader.Item height="32px" />
                  </Loader>
                ) : visibleTags.length === 0 ? (
                  <p className="py-6 text-center text-12 text-placeholder">
                    {tags.length ? "No tags match your search." : "No tags in this project yet."}
                  </p>
                ) : (
                  visibleTags.map(({ name, page_count }) => {
                    const isActive = active?.tag === name;
                    const willMerge =
                      isActive &&
                      active.mode === "rename" &&
                      draftName.trim().toLowerCase() !== name.toLowerCase() &&
                      existingNames.has(draftName.trim().toLowerCase());
                    return (
                      <div
                        key={name}
                        className="group flex min-h-10 items-center justify-between gap-3 rounded-md px-2 py-1.5 hover:bg-layer-transparent-hover"
                      >
                        {isActive && active.mode === "rename" ? (
                          <div className="flex flex-1 flex-col gap-1">
                            <input
                              value={draftName}
                              maxLength={50}
                              onChange={(e) => setDraftName(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") handleRename(name);
                                if (e.key === "Escape") {
                                  e.stopPropagation();
                                  setActive(null);
                                }
                              }}
                              aria-label={`New name for ${name}`}
                              className="w-full rounded-sm border border-accent-strong bg-surface-2 px-2 py-1 text-12 outline-none"
                              // eslint-disable-next-line jsx-a11y/no-autofocus
                              autoFocus
                            />
                            {willMerge && (
                              <span className="text-11 text-tertiary">
                                Will merge into the existing tag &quot;{draftName.trim()}&quot;.
                              </span>
                            )}
                          </div>
                        ) : (
                          <div className="flex min-w-0 items-center gap-2">
                            <PageTagChip tag={name} />
                            <span className="shrink-0 text-11 text-tertiary">{plural(page_count)}</span>
                          </div>
                        )}

                        {isActive && active.mode === "delete" ? (
                          <div className="flex shrink-0 items-center gap-2">
                            <span className="text-11 text-danger-primary">Remove from {plural(page_count)}?</span>
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => setActive(null)}
                              stretch="auto"
                              label="Cancel"
                            />
                            <Button
                              variant="danger"
                              size="sm"
                              loading={isSubmitting}
                              onClick={() => void run(() => deleteProjectTag(name), "deleted")}
                              stretch="auto"
                              label="Delete"
                            />
                          </div>
                        ) : isActive && active.mode === "rename" ? (
                          <div className="flex shrink-0 items-center gap-2">
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => setActive(null)}
                              stretch="auto"
                              label="Cancel"
                            />
                            <Button
                              variant="primary"
                              size="sm"
                              loading={isSubmitting}
                              onClick={() => handleRename(name)}
                              stretch="auto"
                              label={willMerge ? "Merge" : "Save"}
                            />
                          </div>
                        ) : (
                          canCurrentUserCreatePage && (
                            <div className="flex shrink-0 items-center gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100">
                              <button
                                type="button"
                                aria-label={`Rename ${name}`}
                                className="grid size-6 place-items-center rounded text-tertiary hover:bg-layer-2 hover:text-primary"
                                onClick={() => startRename(name)}
                              >
                                <Pencil className="size-3.5" />
                              </button>
                              <button
                                type="button"
                                aria-label={`Delete ${name}`}
                                className="grid size-6 place-items-center rounded text-tertiary hover:bg-layer-2 hover:text-danger-primary"
                                onClick={() => setActive({ tag: name, mode: "delete" })}
                              >
                                <DeleteOutline className="size-3.5" />
                              </button>
                            </div>
                          )
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </DialogBody>
        </DialogMain>
        <DialogActions>
          <Button variant="secondary" size="md" onClick={onClose} stretch="auto" label="Done" />
        </DialogActions>
      </DialogContent>
    </Dialog>
  );
});
