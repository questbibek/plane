/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useEffect, useState } from "react";
import { observer } from "mobx-react";
// plane imports
import { InputField } from "@makeplane/propel/components/input-field";
import { SelectField } from "@makeplane/propel/components/select-field";
import { Switch } from "@makeplane/propel/components/switch";
import { TextAreaField } from "@makeplane/propel/components/text-area-field";
import type { ICustomField, TCustomFieldValueData } from "@plane/types";
// components
import { LabelSelect } from "@/components/dropdowns/label/label-select";
import { MemberSelect } from "@/components/dropdowns/member/member-select";

type Props = {
  field: ICustomField;
  value: TCustomFieldValueData | undefined;
  disabled: boolean;
  projectId: string;
  onSave: (value: TCustomFieldValueData) => void;
};

export const CustomFieldValueInput = observer(function CustomFieldValueInput(props: Props) {
  const { field, value, disabled, projectId, onSave } = props;
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

  // empty-value sentinel: SelectField values are strings, the stored "no value" is null
  const NONE = "";

  switch (field.field_type) {
    case "text":
    case "url":
      return (
        <InputField
          size="md"
          orientation="vertical"
          aria-label={field.name}
          type={field.field_type === "url" ? "url" : "text"}
          value={local}
          onChange={(e) => setLocal(e.target.value)}
          onBlur={() => commit(false)}
          disabled={disabled}
          placeholder={field.settings?.placeholder}
          error={regexError}
        />
      );

    case "paragraph":
      return (
        <TextAreaField
          size="lg"
          aria-label={field.name}
          value={local}
          onChange={(e) => setLocal(e.target.value)}
          onBlur={() => commit(false)}
          disabled={disabled}
          rows={3}
          error={regexError}
        />
      );

    case "number":
      return (
        <InputField
          size="md"
          orientation="vertical"
          aria-label={field.name}
          type="number"
          value={local}
          onChange={(e) => setLocal(e.target.value)}
          onBlur={() => commit(true)}
          disabled={disabled}
          error={regexError}
        />
      );

    case "date":
      return (
        <input
          type="date"
          aria-label={field.name}
          value={typeof value === "string" ? value : ""}
          onChange={(e) => onSave(e.target.value === "" ? null : e.target.value)}
          disabled={disabled}
          className="w-full rounded-md border-[0.5px] border-subtle bg-layer-2 px-3 py-2 text-13 disabled:opacity-60"
        />
      );

    case "checkbox":
      return (
        <Switch
          size="sm"
          aria-label={field.name}
          checked={Boolean(value)}
          onCheckedChange={(val) => onSave(val)}
          disabled={disabled}
        />
      );

    case "select":
      return (
        <SelectField<string>
          aria-label={field.name}
          size="md"
          value={typeof value === "string" ? value : NONE}
          onValueChange={(val) => onSave(val ? val : null)}
          disabled={disabled}
          options={[
            { value: NONE, label: "—" },
            ...options.map((option) => ({ value: option.id, label: option.name })),
          ]}
        />
      );

    case "multi_select":
      return (
        <SelectField<string, true>
          aria-label={field.name}
          size="md"
          multiple
          value={Array.isArray(value) ? value : []}
          onValueChange={(val) => onSave(val)}
          disabled={disabled}
          placeholder="—"
          options={options.map((option) => ({ value: option.id, label: option.name }))}
        />
      );

    case "label":
      return (
        <LabelSelect
          value={Array.isArray(value) ? value : []}
          onChange={(labelIds) => onSave(labelIds)}
          projectId={projectId}
          disabled={disabled}
          variant="select-ghost-md"
          placeholder="—"
        />
      );

    case "member":
      return (
        <MemberSelect
          value={typeof value === "string" ? value : null}
          onChange={(memberId) => onSave(memberId || null)}
          projectId={projectId}
          disabled={disabled}
          variant="select-ghost-md"
          placeholder="—"
          clearable
        />
      );

    default:
      return null;
  }
});
