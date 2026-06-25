/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { Upload } from "lucide-react";
// plane imports
import { setToast, TOAST_TYPE } from "@plane/propel/toast";
import { Button, Loader, ToggleSwitch } from "@plane/ui";
// services
import { JiraImportService, type TJiraImportJob } from "@/services/jira-import.service";

const jiraImportService = new JiraImportService();

const TERMINAL_STATUSES = new Set<TJiraImportJob["status"]>(["completed", "failed"]);
const POLL_INTERVAL_MS = 2500;

export function JiraImportRoot() {
  const { workspaceSlug, projectId } = useParams();
  const slug = workspaceSlug?.toString();
  const project = projectId?.toString();

  const [file, setFile] = useState<File | null>(null);
  const [job, setJob] = useState<TJiraImportJob | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [importComments, setImportComments] = useState(true);
  const [issueTypeAsLabel, setIssueTypeAsLabel] = useState(true);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const isRunning = !!job && !TERMINAL_STATUSES.has(job.status);

  // Load the most recent import job so a refresh resumes showing progress.
  useEffect(() => {
    if (!slug || !project) return;
    jiraImportService
      .listImportJobs(slug, project)
      .then((jobs) => {
        if (jobs?.length) setJob(jobs[0]);
        return jobs;
      })
      .catch(() => {});
  }, [slug, project]);

  // Poll while a job is in flight.
  useEffect(() => {
    const stop = () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
    if (!slug || !project || !job || TERMINAL_STATUSES.has(job.status)) {
      stop();
      return stop;
    }
    pollRef.current = setInterval(() => {
      jiraImportService
        .getImportJob(slug, project, job.id)
        .then((updated) => setJob(updated))
        .catch(() => {});
    }, POLL_INTERVAL_MS);
    return stop;
  }, [slug, project, job]);

  const handleStart = async () => {
    if (!slug || !project || !file) return;
    setIsUploading(true);
    try {
      const created = await jiraImportService.startImport(slug, project, file, {
        import_comments: importComments,
        issue_type_as_label: issueTypeAsLabel,
      });
      setJob(created);
      setFile(null);
      setToast({
        type: TOAST_TYPE.SUCCESS,
        title: "Import started",
        message: "Your Jira CSV is being imported in the background.",
      });
    } catch (error: unknown) {
      const message = (error as { error?: string })?.error ?? "Could not start the import. Please try again.";
      setToast({ type: TOAST_TYPE.ERROR, title: "Import failed to start", message });
    } finally {
      setIsUploading(false);
    }
  };

  const progressPct = job && job.total_rows > 0 ? Math.round((job.processed_rows / job.total_rows) * 100) : 0;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h3 className="text-lg font-medium text-primary">Import from Jira</h3>
        <p className="text-sm mt-1 text-secondary">
          Upload a Jira CSV export. Work items are created with their description, status, priority, assignee, labels,
          comments, the Accountable custom field, and original dates. Users and statuses are matched to this project
          automatically; unmatched statuses are created as new states.
        </p>
      </div>

      {/* Upload */}
      <div className="flex flex-col gap-3 rounded-lg border border-subtle p-4">
        <label
          htmlFor="jira-csv-input"
          className="text-sm hover:bg-surface-3 flex cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed border-subtle bg-surface-2 px-4 py-6 text-secondary"
        >
          <Upload className="size-4" />
          {file ? file.name : "Choose a Jira CSV file (.csv)"}
          <input
            id="jira-csv-input"
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            disabled={isUploading || isRunning}
          />
        </label>

        {/* Import options */}
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-4">
            <div>
              <span className="text-sm text-primary">Import comments</span>
              <p className="text-xs text-secondary">Recreate each Jira comment on the matching work item.</p>
            </div>
            <ToggleSwitch value={importComments} onChange={setImportComments} disabled={isUploading || isRunning} />
          </div>
          <div className="flex items-center justify-between gap-4">
            <div>
              <span className="text-sm text-primary">Add issue type as a label</span>
              <p className="text-xs text-secondary">
                Tag each work item with its Jira issue type (Story, Bug, …) as a label.
              </p>
            </div>
            <ToggleSwitch value={issueTypeAsLabel} onChange={setIssueTypeAsLabel} disabled={isUploading || isRunning} />
          </div>
        </div>

        <div className="flex items-center justify-end">
          <Button variant="primary" onClick={handleStart} loading={isUploading} disabled={!file || isRunning}>
            {isRunning ? "Import in progress" : "Start import"}
          </Button>
        </div>
      </div>

      {/* Progress / result */}
      {job && (
        <div className="flex flex-col gap-3 rounded-lg border border-subtle p-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-primary">
              {job.status === "completed" && "Import complete"}
              {job.status === "failed" && "Import failed"}
              {job.status === "processing" && "Importing…"}
              {job.status === "queued" && "Queued…"}
            </span>
            {isRunning && (
              <Loader className="w-24">
                <Loader.Item height="14px" />
              </Loader>
            )}
          </div>

          {job.total_rows > 0 && (
            <div className="bg-surface-3 h-2 w-full overflow-hidden rounded-full">
              <div
                className="h-full rounded-full bg-accent-primary transition-all"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          )}

          <div className="text-sm flex flex-wrap gap-x-6 gap-y-1 text-secondary">
            <span>Total rows: {job.total_rows}</span>
            <span>Processed: {job.processed_rows}</span>
            <span className="text-success-primary">Created: {job.created_count}</span>
            <span className="text-danger-primary">Skipped: {job.skipped_count}</span>
          </div>

          {job.error_log?.length > 0 && (
            <details className="text-sm">
              <summary className="cursor-pointer text-danger-primary">
                {job.error_log.length} row{job.error_log.length > 1 ? "s" : ""} could not be imported
              </summary>
              <ul className="mt-2 max-h-60 list-disc overflow-y-auto pl-5 text-secondary">
                {job.error_log.map((err) => (
                  <li key={`${err.row}-${err.error.slice(0, 32)}`}>
                    Row {err.row}
                    {err.summary ? ` (${err.summary})` : ""}: {err.error}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}
    </div>
  );
}
