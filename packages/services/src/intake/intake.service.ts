/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { API_BASE_URL } from "@plane/constants";
import { APIService } from "../api.service";

export type TPublicIntakeWorkItemPayload = {
  issue: {
    name: string;
    description_html?: string;
    priority?: "urgent" | "high" | "medium" | "low" | "none";
  };
};

export default class IntakeService extends APIService {
  constructor(BASE_URL?: string) {
    super(BASE_URL || API_BASE_URL);
  }

  /**
   * Submit a work item to a project's published intake form (Plane Sites).
   * Anonymous submissions are allowed when the form is published.
   * @param anchor - The published project board anchor
   * @param intakeId - The project's intake id
   * @param data - The work item payload
   */
  async createPublicIntakeWorkItem(anchor: string, intakeId: string, data: TPublicIntakeWorkItemPayload): Promise<any> {
    return this.post(`/api/public/anchor/${anchor}/intakes/${intakeId}/intake-issues/`, data)
      .then((response) => response?.data)
      .catch((error) => {
        throw error?.response?.data;
      });
  }
}

export { IntakeService };
