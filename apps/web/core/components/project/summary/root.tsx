/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { observer } from "mobx-react";
import Link from "next/link";
import useSWR from "swr";
import { CalendarClock, CircleCheck, FilePlus2, PencilLine } from "lucide-react";
// plane imports
import { BarChart } from "@plane/propel/charts/bar-chart";
import { PieChart } from "@plane/propel/charts/pie-chart";
import { Avatar, Loader } from "@plane/ui";
import { capitalizeFirstLetter, cn, getFileURL } from "@plane/utils";
// services
import { ProjectSummaryService } from "@/services/project";
// local imports
import { statFilters, workItemsHref } from "./links";
import { SummaryPageActivity } from "./page-activity";
import { SummaryRecentActivity } from "./recent-activity";
import { ShareBar, SummaryCard, SummaryEmpty, SummaryRowLink } from "./summary-card";

const summaryService = new ProjectSummaryService();

const PRIORITY_COLORS: Record<string, string> = {
  urgent: "#991b1b",
  high: "#ef4444",
  medium: "#f59e0b",
  low: "#16a34a",
  none: "#a3a3a3",
};

type Props = {
  workspaceSlug: string;
  projectId: string;
};

export const ProjectSummaryRoot = observer(function ProjectSummaryRoot(props: Props) {
  const { workspaceSlug, projectId } = props;
  const { data, error } = useSWR(
    workspaceSlug && projectId ? `PROJECT_SUMMARY_${projectId}` : null,
    () => summaryService.fetch(workspaceSlug, projectId),
    { revalidateOnFocus: true }
  );

  if (error) return <SummaryEmpty message="The summary could not be loaded. Refresh the page to try again." />;
  if (!data)
    return (
      <Loader className="mx-auto grid max-w-6xl gap-4 p-6 md:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <Loader.Item key={i} height="88px" />
        ))}
        <Loader.Item height="320px" className="md:col-span-2" />
        <Loader.Item height="320px" className="md:col-span-2" />
      </Loader>
    );

  const { stats, project } = data;
  const href = (filter?: Parameters<typeof workItemsHref>[2]) => workItemsHref(workspaceSlug, projectId, filter);
  const statCards = [
    {
      icon: CircleCheck,
      value: stats.completed_last_7_days,
      label: "completed",
      hint: "in the last 7 days",
      href: href(statFilters.completed()),
    },
    {
      icon: PencilLine,
      value: stats.updated_last_7_days,
      label: "updated",
      hint: "in the last 7 days",
      href: href(statFilters.updated()),
    },
    {
      icon: FilePlus2,
      value: stats.created_last_7_days,
      label: "created",
      hint: "in the last 7 days",
      href: href(statFilters.created()),
    },
    {
      icon: CalendarClock,
      value: stats.due_next_7_days,
      label: "due soon",
      hint: "in the next 7 days",
      href: href(statFilters.dueSoon()),
    },
  ];
  const statusWithItems = data.status_overview.filter((state) => state.count > 0);
  const labelTotal = data.label_breakdown.reduce((sum, row) => sum + row.count, 0) + data.unlabeled_count;
  const workloadTotal = data.team_workload.reduce((sum, row) => sum + row.count, 0) + data.unassigned_count;
  const showPages = project.page_view;

  return (
    <div className="vertical-scrollbar scrollbar-lg h-full w-full overflow-y-auto">
      <div className="mx-auto max-w-6xl space-y-4 p-6">
        {/* last 7 days */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {statCards.map(({ icon: Icon, value, label, hint, href: cardHref }) => (
            <div
              key={label}
              className="relative flex items-center gap-4 rounded-lg border border-subtle bg-layer-1 p-4 transition-colors hover:border-strong hover:bg-layer-1-hover"
            >
              <span className="grid size-10 shrink-0 place-items-center rounded-md bg-layer-2 text-secondary">
                <Icon className="size-5" />
              </span>
              <div className="min-w-0">
                {/* the whole card is clickable; the overdue link sits above it */}
                <Link href={cardHref} className="text-18 font-semibold text-primary after:absolute after:inset-0">
                  {value} {label}
                </Link>
                <p className="truncate text-13 text-tertiary">
                  {hint}
                  {label === "due soon" && stats.overdue > 0 && (
                    <>
                      {" · "}
                      <Link
                        href={href(statFilters.overdue())}
                        className="relative z-[1] text-danger-primary hover:underline"
                      >
                        {stats.overdue} overdue
                      </Link>
                    </>
                  )}
                </p>
              </div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <SummaryCard
            title="Status overview"
            description="A snapshot of where every work item stands. Click a state to see its items."
            link={{ label: "View all work items", href: href() }}
          >
            {stats.total === 0 ? (
              <SummaryEmpty message="No work items yet." />
            ) : (
              <div className="grid grid-cols-1 items-center gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                <div className="relative h-64">
                  <PieChart
                    className="size-full"
                    dataKey="value"
                    data={statusWithItems.map((state) => ({
                      id: state.id,
                      key: state.id,
                      value: state.count,
                      name: state.name,
                      color: state.color,
                    }))}
                    cells={statusWithItems.map((state) => ({ key: state.id, fill: state.color }))}
                    showTooltip
                    tooltipLabel="Work items"
                    innerRadius="62%"
                    paddingAngle={2}
                    cornerRadius={3}
                    showLabel={false}
                  />
                  <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
                    <div>
                      <p className="text-24 font-semibold text-primary">{stats.total}</p>
                      <p className="text-11 text-tertiary">Total work items</p>
                    </div>
                  </div>
                </div>
                <ul className="space-y-0.5">
                  {data.status_overview.map((state) => (
                    <li key={state.id}>
                      <SummaryRowLink
                        href={href({ state_id__in: state.id })}
                        className="flex items-center justify-between gap-2 text-13"
                      >
                        <span className="flex min-w-0 items-center gap-2">
                          <span className="size-2.5 shrink-0 rounded-xs" style={{ backgroundColor: state.color }} />
                          <span className="truncate text-secondary">{state.name}</span>
                        </span>
                        <span className="text-primary">{state.count}</span>
                      </SummaryRowLink>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </SummaryCard>

          <SummaryCard title="Recent activity" description="Changes to work items, newest first.">
            <SummaryRecentActivity
              activity={data.recent_activity}
              workspaceSlug={workspaceSlug}
              projectId={projectId}
              identifier={project.identifier}
            />
          </SummaryCard>

          <SummaryCard
            title="Priority breakdown"
            description="How work is being prioritized. Click a priority to see its items."
          >
            {stats.total === 0 ? (
              <SummaryEmpty message="No work items yet." />
            ) : (
              <>
                <BarChart
                  className="h-56 w-full"
                  margin={{ top: 16, right: 16, bottom: 4, left: -16 }}
                  data={data.priority_breakdown.map((row) => ({
                    key: row.priority,
                    name: capitalizeFirstLetter(row.priority),
                    count: row.count,
                  }))}
                  bars={[
                    {
                      key: "count",
                      label: "Work items",
                      stackId: "priority",
                      fill: (payload: { key: string }) => PRIORITY_COLORS[payload.key] ?? PRIORITY_COLORS.none,
                      textClassName: "",
                      showPercentage: false,
                      showTopBorderRadius: () => true,
                      showBottomBorderRadius: () => true,
                    },
                  ]}
                  xAxis={{ key: "name", label: "Priority" }}
                  yAxis={{ key: "count", label: "" }}
                  barSize={28}
                />
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {data.priority_breakdown.map((row) => (
                    <Link
                      key={row.priority}
                      href={href({ priority__in: row.priority })}
                      className="flex items-center gap-1.5 rounded-md border border-subtle px-2 py-1 text-11 text-secondary transition-colors hover:bg-layer-2"
                    >
                      <span
                        className="size-2 rounded-full"
                        style={{ backgroundColor: PRIORITY_COLORS[row.priority] }}
                      />
                      {capitalizeFirstLetter(row.priority)}
                      <span className="text-tertiary">{row.count}</span>
                    </Link>
                  ))}
                </div>
              </>
            )}
          </SummaryCard>

          {showPages && (
            <SummaryCard
              title="Pages activity"
              description="Pages created or edited most recently."
              link={{ label: "View all pages", href: `/${workspaceSlug}/projects/${projectId}/pages` }}
            >
              <SummaryPageActivity pages={data.page_activity} workspaceSlug={workspaceSlug} projectId={projectId} />
            </SummaryCard>
          )}

          <SummaryCard
            title="Types of work"
            description="Work items by label, e.g. Bug and Task. An item with two labels counts in both."
          >
            {labelTotal === 0 ? (
              <SummaryEmpty message="No work items yet." />
            ) : (
              <div className="space-y-1">
                {data.label_breakdown.slice(0, 8).map((row) => (
                  <ShareBar
                    key={row.label_id}
                    href={href({ label_id__in: row.label_id })}
                    label={
                      <span className="flex items-center gap-2">
                        <span
                          className="size-2.5 shrink-0 rounded-full"
                          style={{ backgroundColor: row.label__color }}
                        />
                        <span className="truncate">{row.label__name}</span>
                      </span>
                    }
                    count={row.count}
                    total={labelTotal}
                    color={row.label__color || undefined}
                  />
                ))}
                {data.unlabeled_count > 0 && (
                  <ShareBar
                    label={<span className="text-tertiary italic">No label</span>}
                    count={data.unlabeled_count}
                    total={labelTotal}
                    color="var(--border-color-strong)"
                  />
                )}
              </div>
            )}
          </SummaryCard>

          <SummaryCard title="Team workload" description="Work items assigned to each person (open in brackets).">
            {workloadTotal === 0 ? (
              <SummaryEmpty message="No work items yet." />
            ) : (
              <div className="space-y-1">
                {data.team_workload.slice(0, 10).map((row) => (
                  <ShareBar
                    key={row.assignee_id}
                    href={href({ assignee_id__in: row.assignee_id })}
                    label={
                      <span className="flex items-center gap-2">
                        <Avatar
                          name={row.display_name ?? "?"}
                          src={getFileURL(row.avatar_url ?? "")}
                          size="sm"
                          className="shrink-0"
                        />
                        <span className="truncate">
                          {row.display_name ?? "Unknown"} <span className="text-tertiary">({row.open})</span>
                        </span>
                      </span>
                    }
                    count={row.count}
                    total={workloadTotal}
                  />
                ))}
                {data.unassigned_count > 0 && (
                  <ShareBar
                    label={<span className="text-tertiary italic">Unassigned</span>}
                    count={data.unassigned_count}
                    total={workloadTotal}
                    color="var(--border-color-strong)"
                  />
                )}
              </div>
            )}
          </SummaryCard>

          <SummaryCard
            title="Module progress"
            description="Completed work items in each module."
            link={{ label: "View modules", href: `/${workspaceSlug}/projects/${projectId}/modules` }}
            // with the pages card the grid has an odd number of cards; let the last one fill the row
            className={cn({ "lg:col-span-2": showPages })}
          >
            {data.module_progress.length === 0 ? (
              <SummaryEmpty message="No modules with work items yet." />
            ) : (
              <div className="space-y-1">
                {data.module_progress.map((module) => (
                  <ShareBar
                    key={module.id}
                    href={`/${workspaceSlug}/projects/${projectId}/modules/${module.id}`}
                    label={module.name}
                    count={module.done}
                    total={module.total}
                    color="var(--background-color-success-primary, #16a34a)"
                  />
                ))}
              </div>
            )}
          </SummaryCard>
        </div>
      </div>
    </div>
  );
});
