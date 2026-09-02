"use client";

import { useState } from "react";
import { usePolling } from "@/lib/usePolling";
import { PRINT_JOB_STATUS_LABELS, PRINT_JOB_STATUS_STYLES, PRINT_DOCUMENT_TYPE_LABELS } from "@/lib/posOrders";
import { fetchPrintJobs, retryPrintJob, dismissPrintJobs } from "@/lib/pos/printJobsClient";
import type { PrintJob, PrintJobStatus } from "@/lib/posTypes";

const FILTERS: (PrintJobStatus | "")[] = ["FAILED", "PENDING", "SENT", ""];
const FILTER_LABELS: Record<PrintJobStatus | "", string> = { FAILED: "Failed", PENDING: "Pending", SENT: "Sent", "": "All" };

// What comes back is already scoped server-side to what this role may see (WAITER/CASHIER: their
// own kitchen/bar tickets and pre-bills only; Z-reports and guest receipts are hidden) — rendered
// as-is, no client-side filtering on top of that. Dismiss is the same WAITER+ floor as retry, not
// a higher one - a dismissal can only ever touch a document type this role could already see and
// retry, and the person who told the kitchen by voice that a ticket doesn't need reprinting is
// routinely the one standing here, not a manager who wasn't.
export default function PosPrintQueue({ initialJobs, initialFilter }: { initialJobs: PrintJob[]; initialFilter: PrintJobStatus | "" }) {
  const [jobs, setJobs] = useState(initialJobs);
  const [filter, setFilter] = useState(initialFilter);
  const [showDismissed, setShowDismissed] = useState(false);
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const [retryErrors, setRetryErrors] = useState<Record<string, string>>({});
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [dismissing, setDismissing] = useState(false);
  const [dismissError, setDismissError] = useState<string | null>(null);

  async function refetch(activeFilter: PrintJobStatus | "" = filter, activeShowDismissed: boolean = showDismissed) {
    const result = await fetchPrintJobs(activeFilter || undefined, activeShowDismissed);
    if (result.ok) setJobs(result.data);
  }

  usePolling(() => refetch(), 10000);

  function handleFilterChange(next: PrintJobStatus | "") {
    setFilter(next);
    setSelected(new Set());
    refetch(next, showDismissed);
  }

  function handleShowDismissedChange(next: boolean) {
    setShowDismissed(next);
    setSelected(new Set());
    refetch(filter, next);
  }

  async function handleRetry(id: string) {
    setRetryingId(id);
    setRetryErrors((prev) => {
      const { [id]: _dropped, ...rest } = prev;
      return rest;
    });
    const result = await retryPrintJob(id);
    setRetryingId(null);
    if (!result.ok) {
      setRetryErrors((prev) => ({ ...prev, [id]: result.error }));
      return;
    }
    const updated = result.data;
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
    const result = await dismissPrintJobs(ids);
    setDismissing(false);
    if (!result.ok) {
      setDismissError(result.error);
      return;
    }
    // Dismissed jobs drop out of the current view unless "show dismissed" is on.
    setSelected(new Set());
    if (showDismissed) {
      const byId = new Map(result.data.map((j) => [j.id, j]));
      setJobs((prev) => prev.map((j) => byId.get(j.id) ?? j));
    } else {
      const dismissedIds = new Set(result.data.map((j) => j.id));
      setJobs((prev) => prev.filter((j) => !dismissedIds.has(j.id)));
    }
  }

  const failedJobIds = jobs.filter((j) => j.status === "FAILED" && !j.dismissedAt).map((j) => j.id);
  const allFailedSelected = failedJobIds.length > 0 && failedJobIds.every((id) => selected.has(id));

  return (
    <div className="p-4">
      <div className="flex gap-2 overflow-x-auto pb-1 mb-3 -mx-1 px-1">
        {FILTERS.map((f) => (
          <button
            key={f || "ALL"}
            type="button"
            onClick={() => handleFilterChange(f)}
            className={`shrink-0 text-sm rounded-full px-4 py-2.5 font-medium transition-colors ${
              filter === f ? "bg-coral text-ink" : "bg-ink2 text-cream/70"
            }`}
          >
            {FILTER_LABELS[f]}
          </button>
        ))}
      </div>

      <label className="flex items-center gap-2 mb-5 text-sm text-cream/60">
        <input type="checkbox" checked={showDismissed} onChange={(e) => handleShowDismissedChange(e.target.checked)} className="w-4 h-4" />
        Show dismissed
      </label>

      {failedJobIds.length > 0 && (
        <div className="flex items-center gap-3 mb-4 flex-wrap">
          <button
            type="button"
            onClick={() => setSelected(allFailedSelected ? new Set() : new Set(failedJobIds))}
            className="text-sm text-sea underline underline-offset-4"
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
            <div key={job.id} className={`bg-ink2 border rounded-2xl p-4 ${isDismissed ? "border-cream/5 opacity-60" : "border-cream/10"}`}>
              <div className="flex items-start justify-between gap-3 mb-2">
                <div className="flex items-center gap-2 min-w-0">
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
                </div>
                <span className="text-xs text-cream/50 shrink-0">{PRINT_DOCUMENT_TYPE_LABELS[job.documentType]}</span>
              </div>
              <p className="text-cream text-sm">{job.summary}</p>
              <p className="text-xs text-cream/50 mt-1">
                {job.attempts} attempt{job.attempts === 1 ? "" : "s"}
                {job.lastError && <span className="text-coral"> · {job.lastError}</span>}
              </p>
              {isDismissed && job.dismissNote && <p className="text-xs text-cream/40 mt-1">Note: {job.dismissNote}</p>}
              {job.status !== "SENT" && !isDismissed && (
                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    onClick={() => handleRetry(job.id)}
                    disabled={retryingId === job.id}
                    className="flex-1 rounded-xl border border-cream/25 active:border-cream/50 transition-colors py-3 text-sm font-medium disabled:opacity-60"
                  >
                    {retryingId === job.id ? "Retrying…" : "Retry"}
                  </button>
                  {job.status === "FAILED" && (
                    <button
                      type="button"
                      onClick={() => handleDismiss([job.id])}
                      disabled={dismissing}
                      className="flex-1 rounded-xl border border-cream/25 active:border-cream/50 transition-colors py-3 text-sm font-medium disabled:opacity-60"
                    >
                      Dismiss
                    </button>
                  )}
                </div>
              )}
              {retryErrors[job.id] && <p className="text-xs text-coral mt-1.5">{retryErrors[job.id]}</p>}
            </div>
          );
        })}
        {jobs.length === 0 && (
          <p className="text-cream/50 text-sm">No print jobs{filter ? ` with status ${FILTER_LABELS[filter].toLowerCase()}` : ""}.</p>
        )}
      </div>
    </div>
  );
}
