/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { API_BASE_URL } from "@plane/constants";
import type { TPageFolder, TPageFolderDeletionScope } from "@plane/types";
// services
import { APIService } from "@/services/api.service";

export class ProjectPageFolderService extends APIService {
  constructor() {
    super(API_BASE_URL);
  }

  async fetchAll(workspaceSlug: string, projectId: string): Promise<TPageFolder[]> {
    return this.get(`/api/workspaces/${workspaceSlug}/projects/${projectId}/page-folders/`)
      .then((response) => response?.data)
      .catch((error) => {
        throw error?.response?.data;
      });
  }

  async fetchDeletionScope(
    workspaceSlug: string,
    projectId: string,
    folderId: string
  ): Promise<TPageFolder & { deletion_scope: TPageFolderDeletionScope }> {
    return this.get(`/api/workspaces/${workspaceSlug}/projects/${projectId}/page-folders/${folderId}/`)
      .then((response) => response?.data)
      .catch((error) => {
        throw error?.response?.data;
      });
  }

  async create(workspaceSlug: string, projectId: string, data: Partial<TPageFolder>): Promise<TPageFolder> {
    return this.post(`/api/workspaces/${workspaceSlug}/projects/${projectId}/page-folders/`, data)
      .then((response) => response?.data)
      .catch((error) => {
        throw error?.response?.data;
      });
  }

  async update(
    workspaceSlug: string,
    projectId: string,
    folderId: string,
    data: Partial<TPageFolder>
  ): Promise<TPageFolder> {
    return this.patch(`/api/workspaces/${workspaceSlug}/projects/${projectId}/page-folders/${folderId}/`, data)
      .then((response) => response?.data)
      .catch((error) => {
        throw error?.response?.data;
      });
  }

  async remove(workspaceSlug: string, projectId: string, folderId: string): Promise<void> {
    return this.delete(`/api/workspaces/${workspaceSlug}/projects/${projectId}/page-folders/${folderId}/`)
      .then((response) => response?.data)
      .catch((error) => {
        throw error?.response?.data;
      });
  }
}
