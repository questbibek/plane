/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { TWorkItemFilterExpression } from "@plane/types";
import { renderFormattedPayloadDate } from "@plane/utils";

const OPEN_STATE_GROUPS = "backlog,unstarted,started";

const dayOffset = (days: number) => {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return renderFormattedPayloadDate(date) ?? "";
};

/** Work items page with the given filter applied (the page reads `?filter=` and saves it as the filter). */
export const workItemsHref = (workspaceSlug: string, projectId: string, filter?: TWorkItemFilterExpression) => {
  const base = `/${workspaceSlug}/projects/${projectId}/issues`;
  return filter ? `${base}?filter=${encodeURIComponent(JSON.stringify(filter))}` : base;
};

// created_at / updated_at are timestamps, so the range ends tomorrow to include today
const lastSevenDays = () => `${dayOffset(-7)},${dayOffset(1)}`;

/** Filters behind the four stat cards and the overdue hint. */
export const statFilters = {
  // there is no "completed at" filter, so this is completed items that changed this week
  completed: (): TWorkItemFilterExpression => ({
    and: [{ state_group__in: "completed" }, { updated_at__range: lastSevenDays() }],
  }),
  updated: (): TWorkItemFilterExpression => ({ updated_at__range: lastSevenDays() }),
  created: (): TWorkItemFilterExpression => ({ created_at__range: lastSevenDays() }),
  dueSoon: (): TWorkItemFilterExpression => ({
    and: [{ state_group__in: OPEN_STATE_GROUPS }, { target_date__range: `${dayOffset(0)},${dayOffset(7)}` }],
  }),
  overdue: (): TWorkItemFilterExpression => ({
    and: [{ state_group__in: OPEN_STATE_GROUPS }, { target_date__range: `2000-01-01,${dayOffset(-1)}` }],
  }),
};
