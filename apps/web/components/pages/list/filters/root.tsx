/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { observer } from "mobx-react";
import { MenuCheckboxItem, MenuSeparator } from "@makeplane/propel/components/menu";
import type { TPageFilterProps, TPageFilters } from "@plane/types";
// components
import { FilterCreatedDate } from "@/components/common/filters/created-at";
import { FilterCreatedBy } from "@/components/common/filters/created-by";
import type { TFilterSubmenuOption } from "@/components/common/filters/filter-submenu";
import { FilterSubmenu } from "@/components/common/filters/filter-submenu";

type Props = {
  filters: TPageFilters;
  handleFiltersUpdate: <T extends keyof TPageFilters>(filterKey: T, filterValue: TPageFilters[T]) => void;
  memberIds?: string[] | undefined;
  tags?: string[];
};

export const PageFiltersSelection = observer(function PageFiltersSelection(props: Props) {
  const { filters, handleFiltersUpdate, memberIds, tags = [] } = props;
  const tagOptions: TFilterSubmenuOption[] = tags.map((tag) => ({ value: tag, label: tag }));

  const handleFilters = (key: keyof TPageFilterProps, value: boolean | string | string[]) => {
    const newValues = filters.filters?.[key] ?? [];

    if (typeof newValues === "boolean" && typeof value === "boolean") return;

    if (Array.isArray(newValues)) {
      if (Array.isArray(value))
        value.forEach((val) => {
          if (!newValues.includes(val)) newValues.push(val);
          else newValues.splice(newValues.indexOf(val), 1);
        });
      else if (typeof value === "string") {
        if (newValues?.includes(value)) newValues.splice(newValues.indexOf(value), 1);
        else newValues.push(value);
      }
    }

    handleFiltersUpdate("filters", {
      ...filters.filters,
      [key]: newValues,
    });
  };

  return (
    <>
      <MenuCheckboxItem
        label="Favorites"
        checked={!!filters.filters?.favorites}
        onCheckedChange={(checked) =>
          handleFiltersUpdate("filters", {
            ...filters.filters,
            favorites: checked,
          })
        }
      />

      <MenuSeparator />

      {/* created date */}
      <FilterCreatedDate
        appliedFilters={filters.filters?.created_at ?? null}
        handleUpdate={(val) => handleFilters("created_at", val)}
      />

      {/* tags */}
      {tags.length > 0 && (
        <FilterSubmenu
          label="Tags"
          options={tagOptions}
          appliedFilters={filters.filters?.tags ?? null}
          onToggle={(tag) => handleFilters("tags", tag)}
          searchable
        />
      )}

      {/* created by */}
      <FilterCreatedBy
        appliedFilters={filters.filters?.created_by ?? null}
        handleUpdate={(val) => handleFilters("created_by", val)}
        memberIds={memberIds}
      />
    </>
  );
});
