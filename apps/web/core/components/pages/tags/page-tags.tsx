/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useRef, useState } from "react";
import { observer } from "mobx-react";
import { useParams } from "next/navigation";
import { Tags } from "lucide-react";
import { Popover } from "@plane/propel/popover";
import { TOAST_TYPE, setToast } from "@plane/propel/toast";
import { cn } from "@plane/utils";
// plane web hooks
import type { EPageStoreType } from "@/plane-web/hooks/store";
import { usePageStore } from "@/plane-web/hooks/store";
// store
import type { TPageInstance } from "@/store/pages/base-page";
// local imports
import { ManagePageTagsModal } from "./manage-tags-modal";
import { PageTagChip } from "./tag-chip";

const MAX_TAGS = 20;
const MAX_TAG_LENGTH = 50;
const MAX_VISIBLE_TAGS = 3;

type Props = {
  page: TPageInstance;
  projectId: string;
  storeType: EPageStoreType;
  className?: string;
};

export const PageTags = observer(function PageTags(props: Props) {
  const { page, projectId, storeType, className } = props;
  // states
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [isManageOpen, setIsManageOpen] = useState(false);
  // router
  const { workspaceSlug } = useParams();
  // refs
  const inputRef = useRef<HTMLInputElement>(null);
  // store hooks
  const { filters, getProjectTags, updateFilters, updatePageTags } = usePageStore(storeType);
  // derived values
  const tags = page.tags ?? [];
  const canEdit = page.canCurrentUserEditPage;
  const activeFilterTags = new Set((filters.filters?.tags ?? []).map((tag) => tag.toLowerCase()));
  const hasTag = (tag: string) => tags.some((existing) => existing.toLowerCase() === tag.toLowerCase());
  const trimmedQuery = query.trim().replace(/\s+/g, " ");
  const suggestions = getProjectTags(projectId)
    .filter((tag) => !hasTag(tag) && tag.toLowerCase().includes(trimmedQuery.toLowerCase()))
    .slice(0, 8);
  const canCreateFromQuery =
    !!trimmedQuery &&
    !hasTag(trimmedQuery) &&
    !suggestions.some((tag) => tag.toLowerCase() === trimmedQuery.toLowerCase());

  const saveTags = async (nextTags: string[]) => {
    if (!page.id) return;
    try {
      await updatePageTags(page.id, nextTags);
    } catch {
      setToast({ type: TOAST_TYPE.ERROR, title: "Error!", message: "Tags could not be updated. Please try again." });
    }
  };

  const addTag = (raw: string) => {
    const tag = raw.trim().replace(/\s+/g, " ");
    setQuery("");
    // keep typing after picking a suggestion with the mouse
    inputRef.current?.focus();
    if (!tag || hasTag(tag)) return;
    if (tag.length > MAX_TAG_LENGTH) {
      setToast({
        type: TOAST_TYPE.ERROR,
        title: "Error!",
        message: `Tags can be at most ${MAX_TAG_LENGTH} characters.`,
      });
      return;
    }
    if (tags.length >= MAX_TAGS) {
      setToast({ type: TOAST_TYPE.ERROR, title: "Error!", message: `A page can have at most ${MAX_TAGS} tags.` });
      return;
    }
    // saving bumps updated_at, which can re-sort the list and pull focus out of the popover
    void saveTags([...tags, tag]).then(() => requestAnimationFrame(() => inputRef.current?.focus()));
  };

  const removeTag = (tag: string) =>
    void saveTags(tags.filter((existing) => existing !== tag)).then(() =>
      requestAnimationFrame(() => inputRef.current?.focus())
    );

  // clicking a chip toggles it as a filter on the pages list
  const toggleTagFilter = (tag: string) => {
    const current = filters.filters?.tags ?? [];
    const isActive = current.some((existing) => existing.toLowerCase() === tag.toLowerCase());
    updateFilters("filters", {
      ...filters.filters,
      tags: isActive ? current.filter((existing) => existing.toLowerCase() !== tag.toLowerCase()) : [...current, tag],
    });
  };

  const visibleTags = tags.slice(0, MAX_VISIBLE_TAGS);
  const hiddenCount = tags.length - visibleTags.length;

  return (
    <div
      className={cn("flex min-w-0 items-center gap-1", className)}
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
      role="presentation"
    >
      {visibleTags.map((tag) => (
        <PageTagChip
          key={tag}
          tag={tag}
          onClick={() => toggleTagFilter(tag)}
          isActive={activeFilterTags.has(tag.toLowerCase())}
        />
      ))}
      {(canEdit || hiddenCount > 0) && (
        <Popover open={isOpen} onOpenChange={setIsOpen}>
          <Popover.Button
            className={cn(
              "inline-flex h-5 shrink-0 items-center gap-1 rounded-full px-1.5 text-11 text-tertiary hover:bg-layer-transparent-hover hover:text-secondary",
              { "border border-dashed border-subtle": tags.length === 0 }
            )}
            aria-label={canEdit ? "Edit tags" : "Show all tags"}
          >
            {hiddenCount > 0 ? `+${hiddenCount}` : <Tags className="size-3" />}
            {tags.length === 0 && "Add tags"}
          </Popover.Button>
          <Popover.Panel side="bottom" align="start" positionerClassName="z-50" className="w-64">
            <div className="rounded-md border border-subtle bg-surface-1 p-2 shadow-raised-200">
              {tags.length > 0 && (
                <div className="mb-2 flex flex-wrap gap-1">
                  {tags.map((tag) => (
                    <PageTagChip key={tag} tag={tag} onRemove={canEdit ? () => removeTag(tag) : undefined} />
                  ))}
                </div>
              )}
              {canEdit && (
                <>
                  <input
                    ref={inputRef}
                    type="text"
                    value={query}
                    maxLength={MAX_TAG_LENGTH}
                    placeholder={tags.length >= MAX_TAGS ? "Tag limit reached" : "Type a tag and press Enter"}
                    disabled={tags.length >= MAX_TAGS}
                    className="w-full rounded-sm border border-subtle bg-surface-2 px-2 py-1 text-12 outline-none placeholder:text-placeholder focus:border-accent-strong"
                    onChange={(e) => setQuery(e.target.value.replace(",", ""))}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === ",") {
                        e.preventDefault();
                        addTag(query);
                      } else if (e.key === "Backspace" && !query && tags.length > 0) {
                        removeTag(tags[tags.length - 1]);
                      }
                    }}
                  />
                  {(suggestions.length > 0 || canCreateFromQuery) && (
                    <div className="mt-1 max-h-48 overflow-y-auto">
                      {canCreateFromQuery && (
                        <button
                          type="button"
                          className="flex w-full items-center gap-1 rounded-sm px-2 py-1 text-left text-12 text-secondary hover:bg-layer-transparent-hover"
                          onClick={() => addTag(trimmedQuery)}
                        >
                          Create <span className="font-medium text-primary">&quot;{trimmedQuery}&quot;</span>
                        </button>
                      )}
                      {suggestions.map((tag) => (
                        <button
                          key={tag}
                          type="button"
                          className="flex w-full items-center rounded-sm px-2 py-1 text-left hover:bg-layer-transparent-hover"
                          onClick={() => addTag(tag)}
                        >
                          <PageTagChip tag={tag} />
                        </button>
                      ))}
                    </div>
                  )}
                </>
              )}
              <button
                type="button"
                className="mt-2 w-full border-t border-subtle pt-2 text-left text-11 text-tertiary hover:text-primary"
                onClick={() => {
                  setIsOpen(false);
                  setIsManageOpen(true);
                }}
              >
                Manage tags… (rename or delete everywhere)
              </button>
            </div>
          </Popover.Panel>
        </Popover>
      )}
      {isManageOpen && (
        <ManagePageTagsModal
          isOpen
          onClose={() => setIsManageOpen(false)}
          workspaceSlug={workspaceSlug?.toString() ?? ""}
          projectId={projectId}
          storeType={storeType}
        />
      )}
    </div>
  );
});
