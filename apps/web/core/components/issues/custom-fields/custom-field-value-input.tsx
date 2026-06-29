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
  const [regexError, setRegexError] = useState<string | null>(null);

  useEffect(() => {
    setLocal(value != null ? String(value) : "");
  }, [value]);

  const options = field.settings?.options ?? [];

  /** Returns true if `raw` satisfies the field's optional regex restriction. */
  const matchesRegex = (raw: string): boolean => {
    const pattern = field.settings?.regex;
    if (!pattern || raw.trim() === "") return true;
    try {
      return new RegExp(pattern).test(raw.trim());
    } catch {
      // a malformed stored pattern should never block input
      return true;
    }
  };

  /** Validate against the regex, then save (null when cleared). */
  const commit = (asNumber: boolean) => {
    if (!matchesRegex(local)) {
      setRegexError("Value doesn't match the required format.");
      return;
    }
    setRegexError(null);
    if (local.trim() === "") onSave(null);
    else onSave(asNumber ? Number(local) : local);
  };

  const inputErrorClass = regexError ? " border-danger-strong" : "";

  switch (field.field_type) {
    case "text":
    case "url":
      return (
        <div className="w-full">
          <Input
            type={field.field_type === "url" ? "url" : "text"}
            value={local}
            onChange={(e) => setLocal(e.target.value)}
            onBlur={() => commit(false)}
            disabled={disabled}
            placeholder={field.settings?.placeholder}
            className={`w-full text-sm${inputErrorClass}`}
          />
          {regexError && <span className="mt-1 block text-xs text-danger-primary">{regexError}</span>}
        </div>
      );

    case "paragraph":
      return (
        <div className="w-full">
          <TextArea
            value={local}
            onChange={(e) => setLocal(e.target.value)}
            onBlur={() => commit(false)}
            disabled={disabled}
            className={`w-full text-sm${inputErrorClass}`}
            rows={3}
          />
          {regexError && <span className="mt-1 block text-xs text-danger-primary">{regexError}</span>}
        </div>
      );

    case "number":
      return (
        <div className="w-full">
          <Input
            type="number"
            value={local}
            onChange={(e) => setLocal(e.target.value)}
            onBlur={() => commit(true)}
            disabled={disabled}
            className={`w-full text-sm${inputErrorClass}`}
          />
          {regexError && <span className="mt-1 block text-xs text-danger-primary">{regexError}</span>}
        </div>
      );

    case "date":
      return (
        <input
          type="date"
          value={typeof value === "string" ? value : ""}
          onChange={(e) => onSave(e.target.value === "" ? null : e.target.value)}
          disabled={disabled}
          className="w-full rounded-md border-[0.5px] border-subtle bg-layer-2 px-3 py-2 text-13 disabled:opacity-60"
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
