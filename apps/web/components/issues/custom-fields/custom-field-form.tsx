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
import { Button } from "@makeplane/propel/components/button";
import type { ICustomField, ICustomFieldOption, TCustomFieldType } from "@plane/types";
import { IconButton } from "@makeplane/propel/components/icon-button";
import { InputField } from "@makeplane/propel/components/input-field";
import { SelectField } from "@makeplane/propel/components/select-field";
import { Switch } from "@makeplane/propel/components/switch";
import { TextAreaField } from "@makeplane/propel/components/text-area-field";
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
    const cleanedOptions = form.options
      .map((option) => ({ ...option, name: option.name.trim() }))
      .filter((o) => o.name);
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
    <div className="flex flex-col gap-3 rounded-md border border-subtle bg-surface-1 p-4">
      <InputField
        size="md"
        orientation="vertical"
        label={t("project_settings.custom_fields.name")}
        value={form.name}
        onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
        placeholder={t("project_settings.custom_fields.field_name_placeholder")}
      />

      <TextAreaField
        size="lg"
        aria-label={t("project_settings.custom_fields.field_description_placeholder")}
        value={form.description}
        onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
        placeholder={t("project_settings.custom_fields.field_description_placeholder")}
        rows={2}
      />

      <div className="flex items-end gap-4">
        <SelectField<TCustomFieldType>
          label={t("project_settings.custom_fields.type")}
          size="md"
          width="fit"
          value={form.field_type}
          onValueChange={(value) => {
            if (value) setForm((prev) => ({ ...prev, field_type: value }));
          }}
          disabled={isEditing}
          options={CUSTOM_FIELD_TYPES.map((type) => ({ value: type.value, label: type.label }))}
        />

        <label className="flex h-8 items-center gap-2 text-body-xs-regular text-secondary">
          <Switch
            size="sm"
            checked={form.is_required}
            onCheckedChange={(value) => setForm((prev) => ({ ...prev, is_required: value }))}
          />
          {t("project_settings.custom_fields.required")}
        </label>
      </div>

      {showOptions && (
        <div className="flex flex-col gap-2">
          <span className="text-body-xs-medium text-tertiary">{t("project_settings.custom_fields.options")}</span>
          {form.options.map((option) => (
            <div key={option.id} className="flex items-center gap-2">
              <div className="flex-1">
                <InputField
                  size="md"
                  orientation="vertical"
                  aria-label={t("project_settings.custom_fields.option_placeholder")}
                  value={option.name}
                  onChange={(e) => updateOption(option.id, e.target.value)}
                  placeholder={t("project_settings.custom_fields.option_placeholder")}
                />
              </div>
              <IconButton
                variant="ghost"
                size="sm"
                aria-label="Remove option"
                onClick={() => removeOption(option.id)}
                icon={<X className="size-4" />}
              />
            </div>
          ))}
          <button
            type="button"
            onClick={addOption}
            className="self-start text-body-xs-medium text-accent-primary hover:text-accent-secondary"
          >
            + {t("project_settings.custom_fields.add_option")}
          </button>
        </div>
      )}

      {showRegex && (
        <InputField
          size="md"
          orientation="vertical"
          label="Validation pattern (regex)"
          value={form.regex}
          onChange={(e) => setForm((prev) => ({ ...prev, regex: e.target.value }))}
          placeholder="e.g. ^[A-Z]{2,4}-\d+$"
          hint="Optional. Entered values must match this regular expression."
        />
      )}

      {error && <span className="text-body-xs-regular text-danger-primary">{error}</span>}

      <div className="flex items-center justify-end gap-2">
        <Button
          variant="secondary"
          size="sm"
          stretch="auto"
          onClick={onCancel}
          disabled={isSubmitting}
          label={t("project_settings.custom_fields.cancel")}
        />
        <Button
          variant="primary"
          size="sm"
          stretch="auto"
          onClick={handleSubmit}
          loading={isSubmitting}
          label={t("project_settings.custom_fields.save")}
        />
      </div>
    </div>
  );
});
