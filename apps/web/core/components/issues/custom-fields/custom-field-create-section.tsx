/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useEffect } from "react";
import { observer } from "mobx-react";
import useSWR from "swr";
// plane imports
import { SlidersHorizontal } from "lucide-react";
// components
import { SidebarPropertyListItem } from "@/components/common/layout/sidebar/property-list-item";
// hooks
import { useCustomField } from "@/hooks/store/use-custom-field";
// local imports
import { CustomFieldValueInput } from "./custom-field-value-input";

type Props = {
  workspaceSlug: string;
  projectId: string;
};

/**
 * Custom field inputs for the create-work-item modal. Unlike
 * {@link CustomFieldValuesSection}, there is no issue id yet, so values are
 * buffered in the store and flushed once the issue is created.
 */
export const CustomFieldCreateSection = observer(function CustomFieldCreateSection(props: Props) {
  const { workspaceSlug, projectId } = props;
  // store
  const {
    getProjectCustomFields,
    fetchProjectCustomFields,
    pendingCreateValues,
    setPendingCreateValue,
    clearPendingCreateValues,
  } = useCustomField();

  // fetch field definitions for the project
  useSWR(
    workspaceSlug && projectId ? `CUSTOM_FIELDS_${workspaceSlug}_${projectId}` : null,
    workspaceSlug && projectId ? () => fetchProjectCustomFields(workspaceSlug, projectId) : null
  );

  // start blank on open and whenever the target project changes
  useEffect(() => {
    clearPendingCreateValues();
    return () => clearPendingCreateValues();
  }, [projectId, clearPendingCreateValues]);

  const fields = getProjectCustomFields(projectId)?.filter((field) => field.is_active);

  if (!fields || fields.length === 0) return null;

  return (
    <div className="space-y-2">
      {fields.map((field) => (
        <SidebarPropertyListItem key={field.id} icon={SlidersHorizontal} label={field.name}>
          <CustomFieldValueInput
            field={field}
            value={pendingCreateValues[field.id]}
            disabled={false}
            projectId={projectId}
            onSave={(value) => setPendingCreateValue(field.id, value)}
          />
        </SidebarPropertyListItem>
      ))}
    </div>
  );
});
