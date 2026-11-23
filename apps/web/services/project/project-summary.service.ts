/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { API_BASE_URL } from "@plane/constants";
import type { TIssuePriorities, TStateGroups } from "@plane/types";
// services
import { APIService } from "@/services/api.service";

export type TProjectSummaryActivity = {
  id: string;
  verb: string;
  field: string | null;
  old_value: string | null;
  new_value: string | null;
  created_at: string;
  actor: { id: string; display_name: string; avatar_url: string | null } | null;
  issue: { id: string; name: string; sequence_id: number } | null;
};

export type TProjectSummaryPageActivity = {
  id: string;
  name: string;
  verb: "created" | "updated";
  at: string;
  is_private: boolean;
  folder: string | null;
  actor: { id: string; display_name: string; avatar_url: string | null } | null;
};

export type TProjectSummary = {
  project: { id: string; name: string; identifier: string; page_view: boolean };
  stats: {
    total: number;
    completed_last_7_days: number;
    updated_last_7_days: number;
    created_last_7_days: number;
    due_next_7_days: number;
    overdue: number;
  };
  status_overview: { id: string; name: string; color: string; group: TStateGroups; count: number }[];
  priority_breakdown: { priority: TIssuePriorities; count: number }[];
  label_breakdown: { label_id: string; label__name: string; label__color: string; count: number }[];
  unlabeled_count: number;
  team_workload: {
    assignee_id: string;
    display_name: string | null;
    avatar_url: string | null;
    count: number;
    open: number;
  }[];
  unassigned_count: number;
  module_progress: {
    id: string;
    name: string;
    status: string;
    target_date: string | null;
    total: number;
    done: number;
  }[];
  recent_activity: TProjectSummaryActivity[];
  page_activity: TProjectSummaryPageActivity[];
};

export class ProjectSummaryService extends APIService {
  constructor() {
    super(API_BASE_URL);
  }

  async fetch(workspaceSlug: string, projectId: string): Promise<TProjectSummary> {
    return this.get(`/api/workspaces/${workspaceSlug}/projects/${projectId}/summary/`)
      .then((response) => response?.data)
      .catch((error) => {
        throw error?.response?.data;
      });
  }
}
