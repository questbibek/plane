/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useEffect, useState } from "react";
import { observer } from "mobx-react";
// plane imports
import type { ICustomField, ICustomSearchSelectOption, TCustomFieldValueData } from "@plane/types";
import { CustomSearchSelect, CustomSelect, Input, TextArea, ToggleSwitch } from "@plane/ui";
// components
import { MemberDropdown } from "@/components/dropdowns/member/dropdown";
// hooks
import { useLabel } from "@/hooks/store/use-label";

type Props = {
  field: ICustomField;
  value: TCustomFieldValueData | undefined;
  disabled: boolean;
  projectId: string;
  onSave: (value: TCustomFieldValueData) => void;
};

export const CustomFieldValueInput = observer(function CustomFieldValueInput(props: Props) {
  const { field, value, disabled, projectId, onSave } = props;
  // label store (for label picker)
  const { getProjectLabels } = useLabel();
  // local state for text-like inputs (save on blur)
  const [local, setLocal] = useState<string>(value != null ? String(value) : "");

  useEffect(() => {
    setLocal(value != null ? String(value) : "");
  }, [value]);

  const options = field.settings?.options ?? [];

  switch (field.field_type) {
    case "text":
    case "url":
      return (
        <Input
          type={field.field_type === "url" ? "url" : "text"}
          value={local}
          onChange={(e) => setLocal(e.target.value)}
          onBlur={() => onSave(local.trim() === "" ? null : local)}
          disabled={disabled}
          placeholder={field.settings?.placeholder}
          className="w-full text-sm"
        />
      );

    case "paragraph":
      return (
        <TextArea
          value={local}
          onChange={(e) => setLocal(e.target.value)}
          onBlur={() => onSave(local.trim() === "" ? null : local)}
          disabled={disabled}
          className="w-full text-sm"
          rows={3}
        />
      );

    case "number":
      return (
        <Input
          type="number"
          value={local}
          onChange={(e) => setLocal(e.target.value)}
          onBlur={() => onSave(local.trim() === "" ? null : Number(local))}
          disabled={disabled}
          className="w-full text-sm"
        />
      );

    case "date":
      return (
        <input
          type="date"
          value={typeof value === "string" ? value : ""}
          onChange={(e) => onSave(e.target.value === "" ? null : e.target.value)}
          disabled={disabled}
          className="w-full rounded border border-custom-border-200 bg-custom-background-100 px-2 py-1 text-sm disabled:opacity-60"
        />
      );

    case "checkbox":
      return <ToggleSwitch value={Boolean(value)} onChange={(val) => onSave(val)} disabled={disabled} />;

    case "select":
      return (
        <CustomSelect
          value={typeof value === "string" ? value : null}
          label={options.find((option) => option.id === value)?.name ?? "—"}
          onChange={(val: string | null) => onSave(val)}
          disabled={disabled}
          className="w-full"
          maxHeight="lg"
        >
          <CustomSelect.Option value={null}>—</CustomSelect.Option>
          {options.map((option) => (
            <CustomSelect.Option key={option.id} value={option.id}>
              {option.name}
            </CustomSelect.Option>
          ))}
        </CustomSelect>
      );

    case "multi_select": {
      const selectOptions: ICustomSearchSelectOption[] = options.map((option) => ({
        value: option.id,
        query: option.name,
        content: option.name,
      }));
      return (
        <CustomSearchSelect
          value={Array.isArray(value) ? value : []}
          options={selectOptions}
          onChange={(val: string[]) => onSave(val)}
          disabled={disabled}
          multiple
          label={
            Array.isArray(value) && value.length > 0
              ? options
                  .filter((option) => value.includes(option.id))
                  .map((option) => option.name)
                  .join(", ")
              : "—"
          }
          className="w-full"
        />
      );
    }

    case "label": {
      const projectLabels = getProjectLabels(projectId) ?? [];
      const labelOptions: ICustomSearchSelectOption[] = projectLabels.map((label) => ({
        value: label.id,
        query: label.name,
        content: label.name,
      }));
      const selected = Array.isArray(value) ? value : [];
      return (
        <CustomSearchSelect
          value={selected}
          options={labelOptions}
          onChange={(val: string[]) => onSave(val)}
          disabled={disabled}
          multiple
          label={
            selected.length > 0
              ? projectLabels
                  .filter((label) => selected.includes(label.id))
                  .map((label) => label.name)
                  .join(", ")
              : "—"
          }
          className="w-full"
        />
      );
    }

    case "member":
      return (
        <MemberDropdown
          value={typeof value === "string" ? value : null}
          onChange={(val: string | null) => onSave(val)}
          disabled={disabled}
          projectId={projectId}
          multiple={false}
          buttonVariant="transparent-with-text"
          className="w-full grow"
          buttonContainerClassName="w-full text-left h-7.5"
        />
      );

    default:
      return null;
  }
});
