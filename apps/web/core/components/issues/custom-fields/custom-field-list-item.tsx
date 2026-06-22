/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { observer } from "mobx-react";
import { ChevronDown, ChevronUp, Pencil, Trash2 } from "lucide-react";
// plane imports
import { useTranslation } from "@plane/i18n";
import type { ICustomField } from "@plane/types";
// local imports
import { CUSTOM_FIELD_TYPE_LABELS } from "./field-types";

type Props = {
  field: ICustomField;
  isFirst: boolean;
  isLast: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onMove: (direction: "up" | "down") => void;
};

export const CustomFieldListItem = observer(function CustomFieldListItem(props: Props) {
  const { field, isFirst, isLast, onEdit, onDelete, onMove } = props;
  const { t } = useTranslation();

  return (
    <div className="flex items-center justify-between gap-2 rounded-md border border-custom-border-200 bg-custom-background-100 px-3 py-2.5">
      <div className="flex min-w-0 flex-col">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-medium text-custom-text-100">{field.name}</span>
          {field.is_required && (
            <span className="rounded bg-custom-background-80 px-1.5 py-0.5 text-[10px] font-medium uppercase text-custom-text-300">
              {t("project_settings.custom_fields.required")}
            </span>
          )}
        </div>
        <span className="text-xs text-custom-text-300">{CUSTOM_FIELD_TYPE_LABELS[field.field_type]}</span>
      </div>

      <div className="flex items-center gap-1">
        <button
          type="button"
          disabled={isFirst}
          onClick={() => onMove("up")}
          className="grid place-items-center rounded p-1 text-custom-text-300 hover:bg-custom-background-80 disabled:opacity-40"
        >
          <ChevronUp className="size-4" />
        </button>
        <button
          type="button"
          disabled={isLast}
          onClick={() => onMove("down")}
          className="grid place-items-center rounded p-1 text-custom-text-300 hover:bg-custom-background-80 disabled:opacity-40"
        >
          <ChevronDown className="size-4" />
        </button>
        <button
          type="button"
          onClick={onEdit}
          className="grid place-items-center rounded p-1 text-custom-text-300 hover:bg-custom-background-80"
        >
          <Pencil className="size-4" />
        </button>
        <button
          type="button"
          onClick={onDelete}
          className="grid place-items-center rounded p-1 text-custom-text-300 hover:bg-custom-background-80 hover:text-red-500"
        >
          <Trash2 className="size-4" />
        </button>
      </div>
    </div>
  );
});
