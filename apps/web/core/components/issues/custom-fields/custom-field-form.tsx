/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useState } from "react";
import { observer } from "mobx-react";
import { X } from "lucide-react";
// plane imports
import { useTranslation } from "@plane/i18n";
import { Button } from "@plane/propel/button";
import type { ICustomField, ICustomFieldOption, TCustomFieldType } from "@plane/types";
import { CustomSelect, Input, TextArea, ToggleSwitch } from "@plane/ui";
// local imports
import { CUSTOM_FIELD_TYPES, generateOptionId, isOptionField, supportsRegex } from "./field-types";

type TFormData = Pick<ICustomField, "name" | "description" | "field_type" | "is_required"> & {
  options: ICustomFieldOption[];
  regex: string;
};

type Props = {
  data?: ICustomField;
  isSubmitting: boolean;
  onSubmit: (data: Partial<ICustomField>) => Promise<void>;
  onCancel: () => void;
};

export const CustomFieldForm = observer(function CustomFieldForm(props: Props) {
  const { data, isSubmitting, onSubmit, onCancel } = props;
  // translation
  const { t } = useTranslation();
  // form state
  const [form, setForm] = useState<TFormData>({
    name: data?.name ?? "",
    description: data?.description ?? "",
    field_type: data?.field_type ?? "text",
    is_required: data?.is_required ?? false,
    options: data?.settings?.options ?? [],
    regex: data?.settings?.regex ?? "",
  });
  const [error, setError] = useState<string | null>(null);

  const isEditing = Boolean(data);
  const showOptions = isOptionField(form.field_type);
  const showRegex = supportsRegex(form.field_type);

  const updateOption = (id: string, name: string) => {
    setForm((prev) => ({
      ...prev,
      options: prev.options.map((option) => (option.id === id ? { ...option, name } : option)),
    }));
  };

  const addOption = () => {
    setForm((prev) => ({ ...prev, options: [...prev.options, { id: generateOptionId(), name: "" }] }));
  };

  const removeOption = (id: string) => {
    setForm((prev) => ({ ...prev, options: prev.options.filter((option) => option.id !== id) }));
  };

  const handleSubmit = async () => {
    setError(null);
    if (!form.name.trim()) {
      setError(t("project_settings.custom_fields.field_name_placeholder"));
      return;
    }
    const cleanedOptions = form.options.map((option) => ({ ...option, name: option.name.trim() })).filter((o) => o.name);
    if (showOptions && cleanedOptions.length === 0) {
      setError(t("project_settings.custom_fields.add_option"));
      return;
    }

    const trimmedRegex = form.regex.trim();
    if (showRegex && trimmedRegex) {
      try {
        // called (not constructed) just to validate the pattern compiles
        RegExp(trimmedRegex);
      } catch {
        setError("The validation pattern is not a valid regular expression.");
        return;
      }
    }

    let settings: ICustomField["settings"] = {};
    if (showOptions) settings = { options: cleanedOptions };
    else if (showRegex && trimmedRegex) settings = { regex: trimmedRegex };

    const payload: Partial<ICustomField> = {
      name: form.name.trim(),
      description: form.description.trim(),
      field_type: form.field_type,
      is_required: form.is_required,
      settings,
    };
    await onSubmit(payload);
  };

  return (
    <div className="flex flex-col gap-3 rounded-md border border-custom-border-200 bg-custom-background-100 p-4">
      <div className="flex flex-col gap-1">
        <span className="text-xs font-medium text-custom-text-300">
          {t("project_settings.custom_fields.name")}
        </span>
        <Input
          value={form.name}
          onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
          placeholder={t("project_settings.custom_fields.field_name_placeholder")}
          className="w-full"
        />
      </div>

      <TextArea
        value={form.description}
        onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
        placeholder={t("project_settings.custom_fields.field_description_placeholder")}
        className="w-full text-sm"
        rows={2}
      />

      <div className="flex items-center gap-4">
        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium text-custom-text-300">
            {t("project_settings.custom_fields.type")}
          </span>
          <CustomSelect
            value={form.field_type}
            label={CUSTOM_FIELD_TYPES.find((type) => type.value === form.field_type)?.label}
            onChange={(value: TCustomFieldType) => setForm((prev) => ({ ...prev, field_type: value }))}
            disabled={isEditing}
            maxHeight="lg"
          >
            {CUSTOM_FIELD_TYPES.map((type) => (
              <CustomSelect.Option key={type.value} value={type.value}>
                {type.label}
              </CustomSelect.Option>
            ))}
          </CustomSelect>
        </div>

        <label className="flex items-center gap-2 pt-5 text-sm text-custom-text-200">
          <ToggleSwitch
            value={form.is_required}
            onChange={(value) => setForm((prev) => ({ ...prev, is_required: value }))}
          />
          {t("project_settings.custom_fields.required")}
        </label>
      </div>

      {showOptions && (
        <div className="flex flex-col gap-2">
          <span className="text-xs font-medium text-custom-text-300">
            {t("project_settings.custom_fields.options")}
          </span>
          {form.options.map((option) => (
            <div key={option.id} className="flex items-center gap-2">
              <Input
                value={option.name}
                onChange={(e) => updateOption(option.id, e.target.value)}
                placeholder={t("project_settings.custom_fields.option_placeholder")}
                className="w-full"
              />
              <button
                type="button"
                onClick={() => removeOption(option.id)}
                className="grid place-items-center rounded p-1 text-custom-text-300 hover:bg-custom-background-80"
              >
                <X className="size-4" />
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={addOption}
            className="self-start text-xs font-medium text-custom-primary-100 hover:text-custom-primary-200"
          >
            + {t("project_settings.custom_fields.add_option")}
          </button>
        </div>
      )}

      {showRegex && (
        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium text-custom-text-300">Validation pattern (regex)</span>
          <Input
            value={form.regex}
            onChange={(e) => setForm((prev) => ({ ...prev, regex: e.target.value }))}
            placeholder="e.g. ^[A-Z]{2,4}-\d+$"
            className="w-full font-mono"
          />
          <span className="text-xs text-custom-text-400">
            Optional. Entered values must match this regular expression.
          </span>
        </div>
      )}

      {error && <span className="text-xs text-red-500">{error}</span>}

      <div className="flex items-center justify-end gap-2">
        <Button variant="secondary" size="sm" onClick={onCancel} disabled={isSubmitting}>
          {t("project_settings.custom_fields.cancel")}
        </Button>
        <Button variant="primary" size="sm" onClick={handleSubmit} loading={isSubmitting}>
          {t("project_settings.custom_fields.save")}
        </Button>
      </div>
    </div>
  );
});
