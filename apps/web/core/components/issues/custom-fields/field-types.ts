/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { TCustomFieldType } from "@plane/types";

export const CUSTOM_FIELD_TYPES: { value: TCustomFieldType; label: string }[] = [
  { value: "text", label: "Text" },
  { value: "paragraph", label: "Paragraph" },
  { value: "number", label: "Number" },
  { value: "date", label: "Date" },
  { value: "url", label: "URL" },
  { value: "select", label: "Single select" },
  { value: "multi_select", label: "Multi select" },
  { value: "checkbox", label: "Checkbox" },
  { value: "member", label: "User picker" },
  { value: "label", label: "Label picker" },
];

export const CUSTOM_FIELD_TYPE_LABELS: Record<TCustomFieldType, string> = CUSTOM_FIELD_TYPES.reduce(
  (acc, { value, label }) => {
    acc[value] = label;
    return acc;
  },
  {} as Record<TCustomFieldType, string>
);

export const OPTION_FIELD_TYPES: TCustomFieldType[] = ["select", "multi_select"];

export const isOptionField = (type: TCustomFieldType): boolean => OPTION_FIELD_TYPES.includes(type);

/** Local-only id for an option before it is persisted. */
export const generateOptionId = (): string => `opt_${Math.random().toString(36).slice(2, 10)}`;
