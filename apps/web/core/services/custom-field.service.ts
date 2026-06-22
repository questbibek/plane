/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

// constants
import { API_BASE_URL } from "@plane/constants";
// types
import type { ICustomField, ICustomFieldValue } from "@plane/types";
// services
import { APIService } from "@/services/api.service";

export class CustomFieldService extends APIService {
  constructor() {
    super(API_BASE_URL);
  }

  // ---- Field definitions (project-scoped) ----

  async getCustomFields(workspaceSlug: string, projectId: string): Promise<ICustomField[]> {
    return this.get(`/api/workspaces/${workspaceSlug}/projects/${projectId}/custom-fields/`)
      .then((response) => response?.data)
      .catch((error) => {
        throw error?.response?.data;
      });
  }

  async createCustomField(
    workspaceSlug: string,
    projectId: string,
    data: Partial<ICustomField>
  ): Promise<ICustomField> {
    return this.post(`/api/workspaces/${workspaceSlug}/projects/${projectId}/custom-fields/`, data)
      .then((response) => response?.data)
      .catch((error) => {
        throw error?.response?.data;
      });
  }

  async updateCustomField(
    workspaceSlug: string,
    projectId: string,
    fieldId: string,
    data: Partial<ICustomField>
  ): Promise<ICustomField> {
    return this.patch(`/api/workspaces/${workspaceSlug}/projects/${projectId}/custom-fields/${fieldId}/`, data)
      .then((response) => response?.data)
      .catch((error) => {
        throw error?.response?.data;
      });
  }

  async deleteCustomField(workspaceSlug: string, projectId: string, fieldId: string): Promise<void> {
    return this.delete(`/api/workspaces/${workspaceSlug}/projects/${projectId}/custom-fields/${fieldId}/`)
      .then((response) => response?.data)
      .catch((error) => {
        throw error?.response?.data;
      });
  }

  // ---- Field values (per work item) ----

  async getCustomFieldValues(
    workspaceSlug: string,
    projectId: string,
    issueId: string
  ): Promise<ICustomFieldValue[]> {
    return this.get(
      `/api/workspaces/${workspaceSlug}/projects/${projectId}/issues/${issueId}/custom-field-values/`
    )
      .then((response) => response?.data)
      .catch((error) => {
        throw error?.response?.data;
      });
  }

  /** Upserts a value for a (issue, custom_field) pair. */
  async upsertCustomFieldValue(
    workspaceSlug: string,
    projectId: string,
    issueId: string,
    data: Partial<ICustomFieldValue>
  ): Promise<ICustomFieldValue> {
    return this.post(
      `/api/workspaces/${workspaceSlug}/projects/${projectId}/issues/${issueId}/custom-field-values/`,
      data
    )
      .then((response) => response?.data)
      .catch((error) => {
        throw error?.response?.data;
      });
  }

  async updateCustomFieldValue(
    workspaceSlug: string,
    projectId: string,
    issueId: string,
    valueId: string,
    data: Partial<ICustomFieldValue>
  ): Promise<ICustomFieldValue> {
    return this.patch(
      `/api/workspaces/${workspaceSlug}/projects/${projectId}/issues/${issueId}/custom-field-values/${valueId}/`,
      data
    )
      .then((response) => response?.data)
      .catch((error) => {
        throw error?.response?.data;
      });
  }

  async deleteCustomFieldValue(
    workspaceSlug: string,
    projectId: string,
    issueId: string,
    valueId: string
  ): Promise<void> {
    return this.delete(
      `/api/workspaces/${workspaceSlug}/projects/${projectId}/issues/${issueId}/custom-field-values/${valueId}/`
    )
      .then((response) => response?.data)
      .catch((error) => {
        throw error?.response?.data;
      });
  }
}
