"use client";

import { useState } from "react";
import { ADMIN_API_URL } from "@/lib/backend";
import { usePolling } from "@/lib/usePolling";
import {
  PRINT_JOB_STATUS_LABELS,
  PRINT_JOB_STATUS_STYLES,
  PRINT_DOCUMENT_TYPE_LABELS,
} from "@/lib/posOrders";
import type { PrintJob, PrintJobStatus } from "@/lib/posTypes";

const FILTERS: (PrintJobStatus | "")[] = ["FAILED", "PENDING", "SENT", ""];
const FILTER_LABELS: Record<PrintJobStatus | "", string> = {
  FAILED: "Failed",
  PENDING: "Pending",
  SENT: "Sent",
  "": "All",
};

// What comes back is already scoped server-side to what the caller's role
// may see (WAITER/CASHIER: their own kitchen tickets and pre-bills only;
// MANAGER+: everything, including Z-reports and guest receipts) — this
// renders exactly the list the backend returns, with no type-based filtering
// of its own, so it can't drift from that server-side policy.
export default function PrintQueue({
  initialJobs,
  initialFilter,
}: {
  initialJobs: PrintJob[];
  initialFilter: PrintJobStatus | "";
}) {
  const [jobs, setJobs] = useState(initialJobs);
  const [filter, setFilter] = useState(initialFilter);
  const [retryingId, setRetryingId] = useState<string | null>(null);
  // Keyed by job id rather than one shared string — a single banner above
  // the list can't say which of several jobs a retry failure belongs to,
  // and would get wiped by the next unrelated retry attempt.
  const [retryErrors, setRetryErrors] = useState<Record<string, string>>({});

  async function refetch(activeFilter: PrintJobStatus | "" = filter) {
    const query = activeFilter ? `?status=${activeFilter}` : "";
    const res = await fetch(`${ADMIN_API_URL}/print-jobs${query}`, { credentials: "include" });
    if (res.ok) setJobs(await res.json());
  }

  usePolling(() => refetch(), 10000);

  function handleFilterChange(next: PrintJobStatus | "") {
    setFilter(next);
    refetch(next);
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
        [id]: data?.error ? JSON.stringify(data.error) : "Could not retry this job.",
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

      <div className="space-y-3">
        {jobs.map((job) => (
          <div key={job.id} className="flex items-center gap-4 bg-ink2/40 border border-cream/10 rounded-xl p-4">
            <span className={`text-xs rounded-full px-3 py-1 shrink-0 ${PRINT_JOB_STATUS_STYLES[job.status]}`}>
              {PRINT_JOB_STATUS_LABELS[job.status]}
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-cream text-sm truncate">{job.summary}</p>
              <p className="text-xs text-cream/50">
                {PRINT_DOCUMENT_TYPE_LABELS[job.documentType]} · {job.attempts} attempt{job.attempts === 1 ? "" : "s"}
                {job.lastError && <span className="text-coral"> · {job.lastError}</span>}
              </p>
            </div>
            {job.status !== "SENT" && (
              <div className="flex flex-col items-end gap-1 shrink-0">
                <button
                  type="button"
                  onClick={() => handleRetry(job.id)}
                  disabled={retryingId === job.id}
                  className="rounded-full border border-cream/25 hover:border-cream/50 transition-colors px-4 py-2 text-sm font-medium disabled:opacity-60"
                >
                  {retryingId === job.id ? "Retrying…" : "Retry"}
                </button>
                {retryErrors[job.id] && <span className="text-xs text-coral">{retryErrors[job.id]}</span>}
              </div>
            )}
          </div>
        ))}
        {jobs.length === 0 && <p className="text-cream/50 text-sm">No print jobs{filter ? ` with status ${FILTER_LABELS[filter].toLowerCase()}` : ""}.</p>}
      </div>
    </div>
  );
}
