/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { set, sortBy, unset } from "lodash-es";
import { action, computed, makeObservable, observable, runInAction } from "mobx";
import { computedFn } from "mobx-utils";
// types
import type { ICustomField, ICustomFieldValue } from "@plane/types";
// services
import { CustomFieldService } from "@/services/custom-field.service";
// store
import type { CoreRootStore } from "./root.store";

export interface ICustomFieldStore {
  // observables
  fieldMap: Record<string, ICustomField>;
  // issueId -> fieldId -> value
  valueMap: Record<string, Record<string, ICustomFieldValue>>;
  fetchedFieldsMap: Record<string, boolean>;
  fetchedValuesMap: Record<string, boolean>;
  // computed
  projectCustomFields: ICustomField[] | undefined;
  // computed actions
  getProjectCustomFields: (projectId: string | undefined | null) => ICustomField[] | undefined;
  getCustomFieldById: (fieldId: string) => ICustomField | undefined;
  getIssueCustomFieldValues: (issueId: string) => Record<string, ICustomFieldValue> | undefined;
  getIssueCustomFieldValue: (issueId: string, fieldId: string) => ICustomFieldValue | undefined;
  // field definition actions
  fetchProjectCustomFields: (workspaceSlug: string, projectId: string) => Promise<ICustomField[]>;
  createCustomField: (
    workspaceSlug: string,
    projectId: string,
    data: Partial<ICustomField>
  ) => Promise<ICustomField>;
  updateCustomField: (
    workspaceSlug: string,
    projectId: string,
    fieldId: string,
    data: Partial<ICustomField>
  ) => Promise<ICustomField>;
  deleteCustomField: (workspaceSlug: string, projectId: string, fieldId: string) => Promise<void>;
  // value actions
  fetchIssueCustomFieldValues: (
    workspaceSlug: string,
    projectId: string,
    issueId: string
  ) => Promise<ICustomFieldValue[]>;
  setIssueCustomFieldValue: (
    workspaceSlug: string,
    projectId: string,
    issueId: string,
    fieldId: string,
    value: ICustomFieldValue["value"]
  ) => Promise<ICustomFieldValue>;
  deleteIssueCustomFieldValue: (
    workspaceSlug: string,
    projectId: string,
    issueId: string,
    fieldId: string
  ) => Promise<void>;
}

export class CustomFieldStore implements ICustomFieldStore {
  // observables
  fieldMap: Record<string, ICustomField> = {};
  valueMap: Record<string, Record<string, ICustomFieldValue>> = {};
  fetchedFieldsMap: Record<string, boolean> = {};
  fetchedValuesMap: Record<string, boolean> = {};
  // root store
  rootStore;
  // services
  customFieldService;

  constructor(_rootStore: CoreRootStore) {
    makeObservable(this, {
      fieldMap: observable,
      valueMap: observable,
      fetchedFieldsMap: observable,
      fetchedValuesMap: observable,
      // computed
      projectCustomFields: computed,
      // actions
      fetchProjectCustomFields: action,
      createCustomField: action,
      updateCustomField: action,
      deleteCustomField: action,
      fetchIssueCustomFieldValues: action,
      setIssueCustomFieldValue: action,
      deleteIssueCustomFieldValue: action,
    });

    this.rootStore = _rootStore;
    this.customFieldService = new CustomFieldService();
  }

  /** Custom fields for the project currently in the route. */
  get projectCustomFields() {
    const projectId = this.rootStore.router.projectId;
    if (!projectId) return undefined;
    return this.getProjectCustomFields(projectId);
  }

  getProjectCustomFields = computedFn((projectId: string | undefined | null) => {
    if (!projectId || !this.fetchedFieldsMap[projectId]) return undefined;
    return sortBy(
      Object.values(this.fieldMap).filter((field) => field?.project_id === projectId),
      "sort_order"
    );
  });

  getCustomFieldById = computedFn((fieldId: string) => this.fieldMap[fieldId] ?? undefined);

  getIssueCustomFieldValues = computedFn((issueId: string) => this.valueMap[issueId] ?? undefined);

  getIssueCustomFieldValue = computedFn(
    (issueId: string, fieldId: string) => this.valueMap[issueId]?.[fieldId] ?? undefined
  );

  // ---- field definitions ----

  fetchProjectCustomFields = async (workspaceSlug: string, projectId: string) => {
    const response = await this.customFieldService.getCustomFields(workspaceSlug, projectId);
    runInAction(() => {
      response.forEach((field) => set(this.fieldMap, [field.id], field));
      set(this.fetchedFieldsMap, [projectId], true);
    });
    return response;
  };

  createCustomField = async (workspaceSlug: string, projectId: string, data: Partial<ICustomField>) => {
    const response = await this.customFieldService.createCustomField(workspaceSlug, projectId, data);
    runInAction(() => set(this.fieldMap, [response.id], response));
    return response;
  };

  updateCustomField = async (
    workspaceSlug: string,
    projectId: string,
    fieldId: string,
    data: Partial<ICustomField>
  ) => {
    // optimistic update with rollback
    const original = this.fieldMap[fieldId];
    runInAction(() => set(this.fieldMap, [fieldId], { ...original, ...data }));
    try {
      const response = await this.customFieldService.updateCustomField(workspaceSlug, projectId, fieldId, data);
      runInAction(() => set(this.fieldMap, [fieldId], response));
      return response;
    } catch (error) {
      runInAction(() => set(this.fieldMap, [fieldId], original));
      throw error;
    }
  };

  deleteCustomField = async (workspaceSlug: string, projectId: string, fieldId: string) => {
    await this.customFieldService.deleteCustomField(workspaceSlug, projectId, fieldId);
    runInAction(() => unset(this.fieldMap, [fieldId]));
  };

  // ---- values ----

  fetchIssueCustomFieldValues = async (workspaceSlug: string, projectId: string, issueId: string) => {
    const response = await this.customFieldService.getCustomFieldValues(workspaceSlug, projectId, issueId);
    runInAction(() => {
      response.forEach((value) => set(this.valueMap, [issueId, value.custom_field], value));
      set(this.fetchedValuesMap, [issueId], true);
    });
    return response;
  };

  setIssueCustomFieldValue = async (
    workspaceSlug: string,
    projectId: string,
    issueId: string,
    fieldId: string,
    value: ICustomFieldValue["value"]
  ) => {
    const existing = this.valueMap[issueId]?.[fieldId];
    let response: ICustomFieldValue;
    if (existing) {
      response = await this.customFieldService.updateCustomFieldValue(
        workspaceSlug,
        projectId,
        issueId,
        existing.id,
        { value }
      );
    } else {
      response = await this.customFieldService.upsertCustomFieldValue(workspaceSlug, projectId, issueId, {
        custom_field: fieldId,
        value,
      });
    }
    runInAction(() => set(this.valueMap, [issueId, fieldId], response));
    return response;
  };

  deleteIssueCustomFieldValue = async (
    workspaceSlug: string,
    projectId: string,
    issueId: string,
    fieldId: string
  ) => {
    const existing = this.valueMap[issueId]?.[fieldId];
    if (!existing) return;
    await this.customFieldService.deleteCustomFieldValue(workspaceSlug, projectId, issueId, existing.id);
    runInAction(() => unset(this.valueMap, [issueId, fieldId]));
  };
}
