/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useState } from "react";
import { useParams } from "react-router";
import useSWR from "swr";
// plane imports
import { IntakeService, SitesProjectPublishService } from "@plane/services";
import { Button } from "@plane/propel/button";
import { TOAST_TYPE, setToast } from "@plane/propel/toast";
// components
import { LogoSpinner } from "@/components/common/logo-spinner";
import { PoweredBy } from "@/components/common/powered-by";
import { PageNotFound } from "@/components/ui/not-found";

const publishService = new SitesProjectPublishService();
const intakeService = new IntakeService();

const PRIORITIES = [
  { value: "none", label: "None" },
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "urgent", label: "Urgent" },
] as const;

type TPriority = (typeof PRIORITIES)[number]["value"];

const inputClass =
  "w-full rounded-md border-[0.5px] border-subtle bg-surface-1 px-3 py-2 text-sm text-primary placeholder:text-tertiary focus:outline-none";

function IntakeFormPage() {
  const { anchor } = useParams<{ anchor: string }>();
  // form state
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<TPriority>("none");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const {
    data: settings,
    isLoading,
    error,
  } = useSWR(anchor ? `INTAKE_SETTINGS_${anchor}` : null, anchor ? () => publishService.retrieveSettingsByAnchor(anchor) : null);

  if (isLoading) return <LogoSpinner />;

  const intakeId = settings?.intake ?? undefined;
  // form is unavailable if the anchor is invalid or the project hasn't published its intake
  if (error || !settings || !intakeId) return <PageNotFound />;

  const handleSubmit = async () => {
    if (!anchor || !intakeId || !name.trim()) return;
    setIsSubmitting(true);
    try {
      await intakeService.createPublicIntakeWorkItem(anchor, intakeId, {
        issue: {
          name: name.trim(),
          description_html: description.trim() ? `<p>${description.trim()}</p>` : "<p></p>",
          priority,
        },
      });
      setIsSubmitted(true);
    } catch {
      setToast({
        type: TOAST_TYPE.ERROR,
        title: "Could not submit",
        message: "Something went wrong. Please try again.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="relative flex min-h-screen w-full flex-col items-center justify-center bg-surface-2 px-4 py-10">
      <div className="w-full max-w-xl rounded-lg border border-subtle bg-surface-1 p-6 shadow-sm">
        {isSubmitted ? (
          <div className="flex flex-col items-center gap-3 py-8 text-center">
            <h2 className="text-lg font-medium text-primary">Thanks for your submission</h2>
            <p className="text-sm text-secondary">Your work item has been sent to the team&apos;s Intake.</p>
            <Button
              variant="secondary"
              onClick={() => {
                setName("");
                setDescription("");
                setPriority("none");
                setIsSubmitted(false);
              }}
            >
              Submit another
            </Button>
          </div>
        ) : (
          <>
            <div className="mb-5">
              <h1 className="text-lg font-medium text-primary">
                Submit to {settings.project_details?.name ?? "Intake"}
              </h1>
              <p className="mt-1 text-sm text-secondary">Tell us what you need. The team will triage it.</p>
            </div>
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label htmlFor="intake-title" className="text-xs font-medium text-secondary">
                  Title*
                </label>
                <input
                  id="intake-title"
                  className={inputClass}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="A short summary"
                  maxLength={255}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="intake-description" className="text-xs font-medium text-secondary">
                  Description
                </label>
                <textarea
                  id="intake-description"
                  className={inputClass}
                  rows={5}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Add any helpful detail"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="intake-priority" className="text-xs font-medium text-secondary">
                  Priority
                </label>
                <select
                  id="intake-priority"
                  className={inputClass}
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as TPriority)}
                >
                  {PRIORITIES.map((p) => (
                    <option key={p.value} value={p.value}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex justify-end pt-1">
                <Button variant="primary" onClick={handleSubmit} loading={isSubmitting} disabled={!name.trim()}>
                  {isSubmitting ? "Submitting..." : "Submit"}
                </Button>
              </div>
            </div>
          </>
        )}
      </div>
      <div className="mt-6">
        <PoweredBy />
      </div>
    </div>
  );
}

export default IntakeFormPage;
