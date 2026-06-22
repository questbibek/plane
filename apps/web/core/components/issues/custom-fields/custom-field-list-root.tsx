/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useState } from "react";
import { observer } from "mobx-react";
import { useParams } from "next/navigation";
import useSWR from "swr";
// plane imports
import { useTranslation } from "@plane/i18n";
import { Button } from "@plane/propel/button";
import { setToast, TOAST_TYPE } from "@plane/propel/toast";
import type { ICustomField } from "@plane/types";
import { AlertModalCore, Loader } from "@plane/ui";
// hooks
import { useCustomField } from "@/hooks/store/use-custom-field";
// local imports
import { CustomFieldForm } from "./custom-field-form";
import { CustomFieldListItem } from "./custom-field-list-item";

export const CustomFieldListRoot = observer(function CustomFieldListRoot() {
  // router
  const { workspaceSlug, projectId } = useParams();
  // store
  const {
    getProjectCustomFields,
    fetchProjectCustomFields,
    createCustomField,
    updateCustomField,
    deleteCustomField,
  } = useCustomField();
  // translation
  const { t } = useTranslation();
  // state
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingField, setEditingField] = useState<ICustomField | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deletingField, setDeletingField] = useState<ICustomField | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // fetch fields
  const { isLoading } = useSWR(
    workspaceSlug && projectId ? `CUSTOM_FIELDS_${workspaceSlug}_${projectId}` : null,
    workspaceSlug && projectId
      ? () => fetchProjectCustomFields(workspaceSlug.toString(), projectId.toString())
      : null
  );

  const fields = getProjectCustomFields(projectId?.toString());

  const handleCreate = async (data: Partial<ICustomField>) => {
    if (!workspaceSlug || !projectId) return;
    setIsSubmitting(true);
    try {
      // place new field at the end
      const sortOrder = (fields?.length ? fields[fields.length - 1].sort_order : 0) + 1000;
      await createCustomField(workspaceSlug.toString(), projectId.toString(), { ...data, sort_order: sortOrder });
      setToast({ type: TOAST_TYPE.SUCCESS, title: t("project_settings.custom_fields.toast.create_success") });
      setIsFormOpen(false);
    } catch {
      setToast({ type: TOAST_TYPE.ERROR, title: t("project_settings.custom_fields.toast.create_error") });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdate = async (data: Partial<ICustomField>) => {
    if (!workspaceSlug || !projectId || !editingField) return;
    setIsSubmitting(true);
    try {
      await updateCustomField(workspaceSlug.toString(), projectId.toString(), editingField.id, data);
      setToast({ type: TOAST_TYPE.SUCCESS, title: t("project_settings.custom_fields.toast.update_success") });
      setEditingField(null);
    } catch {
      setToast({ type: TOAST_TYPE.ERROR, title: t("project_settings.custom_fields.toast.update_error") });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!workspaceSlug || !projectId || !deletingField) return;
    setIsDeleting(true);
    try {
      await deleteCustomField(workspaceSlug.toString(), projectId.toString(), deletingField.id);
      setToast({ type: TOAST_TYPE.SUCCESS, title: t("project_settings.custom_fields.toast.delete_success") });
      setDeletingField(null);
    } catch {
      setToast({ type: TOAST_TYPE.ERROR, title: t("project_settings.custom_fields.toast.delete_error") });
    } finally {
      setIsDeleting(false);
    }
  };

  const handleMove = async (field: ICustomField, direction: "up" | "down") => {
    if (!workspaceSlug || !projectId || !fields) return;
    const index = fields.findIndex((f) => f.id === field.id);
    const swapWith = direction === "up" ? fields[index - 1] : fields[index + 1];
    if (!swapWith) return;
    // swap sort orders
    try {
      await Promise.all([
        updateCustomField(workspaceSlug.toString(), projectId.toString(), field.id, {
          sort_order: swapWith.sort_order,
        }),
        updateCustomField(workspaceSlug.toString(), projectId.toString(), swapWith.id, {
          sort_order: field.sort_order,
        }),
      ]);
    } catch {
      setToast({ type: TOAST_TYPE.ERROR, title: t("project_settings.custom_fields.toast.update_error") });
    }
  };

  return (
    <div className="flex flex-col gap-4 py-2">
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col">
          <h3 className="text-lg font-medium text-custom-text-100">{t("project_settings.custom_fields.title")}</h3>
          <p className="text-sm text-custom-text-300">{t("project_settings.custom_fields.description")}</p>
        </div>
        {!isFormOpen && !editingField && (
          <Button variant="primary" size="sm" onClick={() => setIsFormOpen(true)}>
            {t("project_settings.custom_fields.add_field")}
          </Button>
        )}
      </div>

      {isFormOpen && (
        <CustomFieldForm isSubmitting={isSubmitting} onSubmit={handleCreate} onCancel={() => setIsFormOpen(false)} />
      )}

      {isLoading && !fields ? (
        <Loader className="flex flex-col gap-2">
          <Loader.Item height="56px" />
          <Loader.Item height="56px" />
          <Loader.Item height="56px" />
        </Loader>
      ) : (
        <div className="flex flex-col gap-2">
          {fields?.length === 0 && !isFormOpen && (
            <p className="rounded-md border border-dashed border-custom-border-200 px-4 py-6 text-center text-sm text-custom-text-300">
              {t("project_settings.custom_fields.empty_state")}
            </p>
          )}
          {fields?.map((field, index) =>
            editingField?.id === field.id ? (
              <CustomFieldForm
                key={field.id}
                data={field}
                isSubmitting={isSubmitting}
                onSubmit={handleUpdate}
                onCancel={() => setEditingField(null)}
              />
            ) : (
              <CustomFieldListItem
                key={field.id}
                field={field}
                isFirst={index === 0}
                isLast={index === fields.length - 1}
                onEdit={() => setEditingField(field)}
                onDelete={() => setDeletingField(field)}
                onMove={(direction) => handleMove(field, direction)}
              />
            )
          )}
        </div>
      )}

      <AlertModalCore
        isOpen={Boolean(deletingField)}
        handleClose={() => setDeletingField(null)}
        handleSubmit={handleDelete}
        isSubmitting={isDeleting}
        title={t("project_settings.custom_fields.title")}
        content={t("project_settings.custom_fields.delete_confirm")}
      />
    </div>
  );
});
