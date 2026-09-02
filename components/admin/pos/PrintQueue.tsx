"use client";

import { useState } from "react";
import { ADMIN_API_URL } from "@/lib/backend";
import { extractApiError } from "@/lib/apiError";
import { usePolling } from "@/lib/usePolling";
import {
  PRINT_JOB_STATUS_LABELS,
  PRINT_JOB_STATUS_STYLES,
  PRINT_DOCUMENT_TYPE_LABELS,
} from "@/lib/posOrders";
import type { DismissPrintJobsInput, PrintJob, PrintJobStatus, PrintDocumentType } from "@/lib/posTypes";

const FILTERS: (PrintJobStatus | "")[] = ["FAILED", "PENDING", "SENT", ""];
const FILTER_LABELS: Record<PrintJobStatus | "", string> = {
  FAILED: "Failed",
  PENDING: "Pending",
  SENT: "Sent",
  "": "All",
};

// Kitchen and bar tickets used to be one document type (KITCHEN_TICKET
// covered both); now that the backend splits them, a station filter lets
// kitchen and bar failures be checked separately instead of scrolling past
// each other in one merged list. Doesn't include every PrintDocumentType —
// pre-bill/receipt/Z-report/test-page failures aren't a "station" concern.
const DOC_TYPE_FILTERS: (PrintDocumentType | "")[] = ["", "KITCHEN_TICKET", "BAR_TICKET"];
const DOC_TYPE_FILTER_LABELS: Record<PrintDocumentType | "", string> = {
  ...PRINT_DOCUMENT_TYPE_LABELS,
  "": "All stations",
};

// What comes back is already scoped server-side to what the caller's role
// may see (WAITER/CASHIER: their own kitchen tickets and pre-bills only;
// MANAGER+: everything, including Z-reports and guest receipts) — this
// renders exactly the list the backend returns, with no type-based filtering
// of its own, so it can't drift from that server-side policy. Dismiss is the
// same WAITER+ floor as retry - a dismissal can only ever touch a document
// type this role could already see and retry.
export default function PrintQueue({
  initialJobs,
  initialFilter,
}: {
  initialJobs: PrintJob[];
  initialFilter: PrintJobStatus | "";
}) {
  const [jobs, setJobs] = useState(initialJobs);
  const [filter, setFilter] = useState(initialFilter);
  const [docTypeFilter, setDocTypeFilter] = useState<PrintDocumentType | "">("");
  const [showDismissed, setShowDismissed] = useState(false);
  const [retryingId, setRetryingId] = useState<string | null>(null);
  // Keyed by job id rather than one shared string — a single banner above
  // the list can't say which of several jobs a retry failure belongs to,
  // and would get wiped by the next unrelated retry attempt.
  const [retryErrors, setRetryErrors] = useState<Record<string, string>>({});
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [dismissing, setDismissing] = useState(false);
  const [dismissError, setDismissError] = useState<string | null>(null);

  async function refetch(
    activeFilter: PrintJobStatus | "" = filter,
    activeDocTypeFilter: PrintDocumentType | "" = docTypeFilter,
    activeShowDismissed: boolean = showDismissed
  ) {
    const params = new URLSearchParams();
    if (activeFilter) params.set("status", activeFilter);
    if (activeDocTypeFilter) params.set("documentType", activeDocTypeFilter);
    if (activeShowDismissed) params.set("includeDismissed", "true");
    const query = params.toString();
    const res = await fetch(`${ADMIN_API_URL}/print-jobs${query ? `?${query}` : ""}`, { credentials: "include" });
    if (res.ok) setJobs(await res.json());
  }

  usePolling(() => refetch(), 10000);

  function handleFilterChange(next: PrintJobStatus | "") {
    setFilter(next);
    setSelected(new Set());
    refetch(next, docTypeFilter, showDismissed);
  }

  function handleDocTypeFilterChange(next: PrintDocumentType | "") {
    setDocTypeFilter(next);
    setSelected(new Set());
    refetch(filter, next, showDismissed);
  }

  function handleShowDismissedChange(next: boolean) {
    setShowDismissed(next);
    setSelected(new Set());
    refetch(filter, docTypeFilter, next);
  }

  async function handleRetry(id: string) {
    setRetryingId(id);
    setRetryErrors((prev) => {
      const { [id]: _dropped, ...rest } = prev;
      return rest;
    });
    const res = await fetch(`${ADMIN_API_URL}/print-jobs/${id}/retry`, {
      method: "POST",
      credentials: "include",
    });
    setRetryingId(null);

    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setRetryErrors((prev) => ({
        ...prev,
        [id]: extractApiError(data, "Could not retry this job."),
      }));
      return;
    }
    const updated: PrintJob = await res.json();
    // A retry that now falls outside the active filter (e.g. FAILED -> SENT
    // while viewing "Failed") should drop off the list rather than linger
    // showing a stale status.
    setJobs((prev) =>
      filter && updated.status !== filter ? prev.filter((j) => j.id !== id) : prev.map((j) => (j.id === id ? updated : j))
    );
  }

  function toggleSelected(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleDismiss(ids: string[]) {
    if (ids.length === 0) return;
    setDismissing(true);
    setDismissError(null);
    const body: DismissPrintJobsInput = { ids };
    const res = await fetch(`${ADMIN_API_URL}/print-jobs/dismiss`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setDismissing(false);

    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setDismissError(extractApiError(data, "Could not dismiss these jobs."));
      return;
    }
    const dismissed: PrintJob[] = await res.json();
    setSelected(new Set());
    if (showDismissed) {
      const byId = new Map(dismissed.map((j) => [j.id, j]));
      setJobs((prev) => prev.map((j) => byId.get(j.id) ?? j));
    } else {
      const dismissedIds = new Set(dismissed.map((j) => j.id));
      setJobs((prev) => prev.filter((j) => !dismissedIds.has(j.id)));
    }
  }

  const failedJobIds = jobs.filter((j) => j.status === "FAILED" && !j.dismissedAt).map((j) => j.id);
  const allFailedSelected = failedJobIds.length > 0 && failedJobIds.every((id) => selected.has(id));

  return (
    <div>
      <div className="flex flex-wrap gap-2 mb-6">
        {FILTERS.map((f) => (
          <button
            key={f || "ALL"}
            type="button"
            onClick={() => handleFilterChange(f)}
            className={`text-sm rounded-full px-4 py-2 transition-colors ${
              filter === f ? "bg-coral text-ink" : "bg-ink2/40 border border-cream/10 text-cream/70 hover:text-cream"
            }`}
          >
            {FILTER_LABELS[f]}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-2 mb-6">
        {DOC_TYPE_FILTERS.map((t) => (
          <button
            key={t || "ALL"}
            type="button"
            onClick={() => handleDocTypeFilterChange(t)}
            className={`text-sm rounded-full px-4 py-2 transition-colors ${
              docTypeFilter === t ? "bg-sea text-ink" : "bg-ink2/40 border border-cream/10 text-cream/70 hover:text-cream"
            }`}
          >
            {DOC_TYPE_FILTER_LABELS[t]}
          </button>
        ))}
      </div>

      <label className="flex items-center gap-2 mb-4 text-sm text-cream/60">
        <input type="checkbox" checked={showDismissed} onChange={(e) => handleShowDismissedChange(e.target.checked)} className="w-4 h-4" />
        Show dismissed
      </label>

      {failedJobIds.length > 0 && (
        <div className="flex items-center gap-3 mb-4 flex-wrap">
          <button
            type="button"
            onClick={() => setSelected(allFailedSelected ? new Set() : new Set(failedJobIds))}
            className="text-sm text-sea hover:text-coral transition-colors underline underline-offset-4"
          >
            {allFailedSelected ? "Clear selection" : `Select all failed (${failedJobIds.length})`}
          </button>
          {selected.size > 0 && (
            <button
              type="button"
              onClick={() => handleDismiss([...selected])}
              disabled={dismissing}
              className="rounded-full bg-coral hover:bg-coraldeep transition-colors px-4 py-2 text-sm font-medium disabled:opacity-60"
            >
              {dismissing ? "Dismissing…" : `Dismiss selected (${selected.size})`}
            </button>
          )}
        </div>
      )}
      {dismissError && <p className="text-xs text-coral mb-4">{dismissError}</p>}

      <div className="space-y-3">
        {jobs.map((job) => {
          const isDismissed = Boolean(job.dismissedAt);
          return (
            <div
              key={job.id}
              className={`flex items-center gap-4 bg-ink2/40 border rounded-xl p-4 ${isDismissed ? "border-cream/5 opacity-60" : "border-cream/10"}`}
            >
              {job.status === "FAILED" && !isDismissed && (
                <input
                  type="checkbox"
                  checked={selected.has(job.id)}
                  onChange={() => toggleSelected(job.id)}
                  className="w-4 h-4 shrink-0"
                  aria-label="Select for bulk dismiss"
                />
              )}
              <span className={`text-xs rounded-full px-3 py-1 shrink-0 ${PRINT_JOB_STATUS_STYLES[job.status]}`}>
                {PRINT_JOB_STATUS_LABELS[job.status]}
              </span>
              {isDismissed && <span className="text-xs text-cream/40 shrink-0">Dismissed</span>}
              <div className="flex-1 min-w-0">
                <p className="text-cream text-sm truncate">{job.summary}</p>
                <p className="text-xs text-cream/50">
                  {PRINT_DOCUMENT_TYPE_LABELS[job.documentType]} · {job.attempts} attempt{job.attempts === 1 ? "" : "s"}
                  {job.lastError && <span className="text-coral"> · {job.lastError}</span>}
                  {isDismissed && job.dismissNote && <span> · Note: {job.dismissNote}</span>}
                </p>
              </div>
              {job.status !== "SENT" && !isDismissed && (
                <div className="flex flex-col items-end gap-1 shrink-0">
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => handleRetry(job.id)}
                      disabled={retryingId === job.id}
                      className="rounded-full border border-cream/25 hover:border-cream/50 transition-colors px-4 py-2 text-sm font-medium disabled:opacity-60"
                    >
                      {retryingId === job.id ? "Retrying…" : "Retry"}
                    </button>
                    {job.status === "FAILED" && (
                      <button
                        type="button"
                        onClick={() => handleDismiss([job.id])}
                        disabled={dismissing}
                        className="rounded-full border border-cream/25 hover:border-cream/50 transition-colors px-4 py-2 text-sm font-medium disabled:opacity-60"
                      >
                        Dismiss
                      </button>
                    )}
                  </div>
                  {retryErrors[job.id] && <span className="text-xs text-coral">{retryErrors[job.id]}</span>}
                </div>
              )}
            </div>
          );
        })}
        {jobs.length === 0 && <p className="text-cream/50 text-sm">No print jobs{filter ? ` with status ${FILTER_LABELS[filter].toLowerCase()}` : ""}.</p>}
      </div>
    </div>
  );
}
