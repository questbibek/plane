/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { observer } from "mobx-react";
import useSWR from "swr";
// plane imports
import { SlidersHorizontal } from "lucide-react";
import { setToast, TOAST_TYPE } from "@plane/propel/toast";
import type { TCustomFieldValueData } from "@plane/types";
// components
import { SidebarPropertyListItem } from "@/components/common/layout/sidebar/property-list-item";
// hooks
import { useCustomField } from "@/hooks/store/use-custom-field";
// local imports
import { CustomFieldValueInput } from "./custom-field-value-input";

type Props = {
  workspaceSlug: string;
  projectId: string;
  issueId: string;
  isEditable: boolean;
};

export const CustomFieldValuesSection = observer(function CustomFieldValuesSection(props: Props) {
  const { workspaceSlug, projectId, issueId, isEditable } = props;
  // store
  const {
    getProjectCustomFields,
    fetchProjectCustomFields,
    fetchIssueCustomFieldValues,
    getIssueCustomFieldValue,
    setIssueCustomFieldValue,
  } = useCustomField();

  // fetch field definitions for the project
  useSWR(
    workspaceSlug && projectId ? `CUSTOM_FIELDS_${workspaceSlug}_${projectId}` : null,
    workspaceSlug && projectId ? () => fetchProjectCustomFields(workspaceSlug, projectId) : null
  );

  // fetch values for the work item
  useSWR(
    workspaceSlug && projectId && issueId ? `CUSTOM_FIELD_VALUES_${issueId}` : null,
    workspaceSlug && projectId && issueId
      ? () => fetchIssueCustomFieldValues(workspaceSlug, projectId, issueId)
      : null
  );

  const fields = getProjectCustomFields(projectId);

  if (!fields || fields.length === 0) return null;

  const handleSave = async (fieldId: string, value: TCustomFieldValueData) => {
    try {
      await setIssueCustomFieldValue(workspaceSlug, projectId, issueId, fieldId, value);
    } catch {
      setToast({ type: TOAST_TYPE.ERROR, title: "Failed to save custom field value" });
    }
  };

  return (
    <>
      {fields
        .filter((field) => field.is_active)
        .map((field) => (
          <SidebarPropertyListItem key={field.id} icon={SlidersHorizontal} label={field.name}>
            <CustomFieldValueInput
              field={field}
              value={getIssueCustomFieldValue(issueId, field.id)?.value}
              disabled={!isEditable}
              projectId={projectId}
              onSave={(value) => handleSave(field.id, value)}
            />
          </SidebarPropertyListItem>
        ))}
    </>
  );
});
