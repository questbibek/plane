/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

// constants
import { API_BASE_URL } from "@plane/constants";
// services
import { APIService } from "@/services/api.service";

export type TJiraImportStatus = "queued" | "processing" | "completed" | "failed";

export type TJiraImportError = {
  row: number;
  summary?: string;
  error: string;
};

export type TJiraImportConfig = {
  import_comments?: boolean;
  issue_type_as_label?: boolean;
};

export type TJiraImportJob = {
  id: string;
  status: TJiraImportStatus;
  total_rows: number;
  processed_rows: number;
  created_count: number;
  skipped_count: number;
  summary: { created?: number; skipped?: number; total?: number; errors?: number };
  error_log: TJiraImportError[];
  created_at: string;
  updated_at: string;
};

export class JiraImportService extends APIService {
  constructor() {
    super(API_BASE_URL);
  }

  async startImport(
    workspaceSlug: string,
    projectId: string,
    file: File,
    config?: TJiraImportConfig
  ): Promise<TJiraImportJob> {
    const formData = new FormData();
    formData.append("file", file);
    if (config) formData.append("config", JSON.stringify(config));
    return this.post(`/api/workspaces/${workspaceSlug}/projects/${projectId}/jira-imports/`, formData)
      .then((response) => response?.data)
      .catch((error) => {
        throw error?.response?.data;
      });
  }

  async getImportJob(workspaceSlug: string, projectId: string, jobId: string): Promise<TJiraImportJob> {
    return this.get(`/api/workspaces/${workspaceSlug}/projects/${projectId}/jira-imports/${jobId}/`)
      .then((response) => response?.data)
      .catch((error) => {
        throw error?.response?.data;
      });
  }

  async listImportJobs(workspaceSlug: string, projectId: string): Promise<TJiraImportJob[]> {
    return this.get(`/api/workspaces/${workspaceSlug}/projects/${projectId}/jira-imports/`)
      .then((response) => response?.data)
      .catch((error) => {
        throw error?.response?.data;
      });
  }
}
