/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

export type TCustomFieldType =
  | "text"
  | "paragraph"
  | "number"
  | "date"
  | "url"
  | "select"
  | "multi_select"
  | "checkbox"
  | "member"
  | "label";

/** A single option for select / multi_select fields. */
export interface ICustomFieldOption {
  id: string;
  name: string;
  color?: string;
}

/** Type-specific configuration persisted in the field's `settings` JSON. */
export interface ICustomFieldSettings {
  /** Options for select / multi_select fields. */
  options?: ICustomFieldOption[];
  /** Validation hints for number / text fields. */
  min?: number;
  max?: number;
  regex?: string;
  placeholder?: string;
}

/** A value can hold any of the supported per-type payloads. */
export type TCustomFieldValueData = string | number | boolean | string[] | null;

export interface ICustomField {
  readonly id: string;
  name: string;
  description: string;
  field_type: TCustomFieldType;
  settings: ICustomFieldSettings;
  default_value: TCustomFieldValueData;
  sort_order: number;
  is_required: boolean;
  is_active: boolean;
  external_source: string | null;
  external_id: string | null;
  project_id: string;
  workspace_id: string;
  created_at: string;
  updated_at: string;
}

export interface ICustomFieldValue {
  readonly id: string;
  custom_field: string;
  issue: string;
  value: TCustomFieldValueData;
  project_id: string;
  workspace_id: string;
  created_at: string;
  updated_at: string;
}

export type TCustomFieldOperationsCallbacks = {
  createCustomField: (data: Partial<ICustomField>) => Promise<ICustomField>;
  updateCustomField: (fieldId: string, data: Partial<ICustomField>) => Promise<ICustomField | undefined>;
  deleteCustomField: (fieldId: string) => Promise<void>;
};
