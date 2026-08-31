"use client";

import { useState } from "react";
import { usePolling } from "@/lib/usePolling";
import { PRINT_JOB_STATUS_LABELS, PRINT_JOB_STATUS_STYLES, PRINT_DOCUMENT_TYPE_LABELS } from "@/lib/posOrders";
import { fetchPrintJobs, retryPrintJob } from "@/lib/pos/printJobsClient";
import type { PrintJob, PrintJobStatus } from "@/lib/posTypes";

const FILTERS: (PrintJobStatus | "")[] = ["FAILED", "PENDING", "SENT", ""];
const FILTER_LABELS: Record<PrintJobStatus | "", string> = { FAILED: "Failed", PENDING: "Pending", SENT: "Sent", "": "All" };

// What comes back is already scoped server-side to what this role may see (WAITER/CASHIER: their
// own kitchen/bar tickets and pre-bills only; Z-reports and guest receipts are hidden) — rendered
// as-is, no client-side filtering on top of that.
export default function PosPrintQueue({ initialJobs, initialFilter }: { initialJobs: PrintJob[]; initialFilter: PrintJobStatus | "" }) {
  const [jobs, setJobs] = useState(initialJobs);
  const [filter, setFilter] = useState(initialFilter);
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const [retryErrors, setRetryErrors] = useState<Record<string, string>>({});

  async function refetch(activeFilter: PrintJobStatus | "" = filter) {
    const result = await fetchPrintJobs(activeFilter || undefined);
    if (result.ok) setJobs(result.data);
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

  return (
    <div className="p-4">
      <div className="flex gap-2 overflow-x-auto pb-1 mb-5 -mx-1 px-1">
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

      <div className="space-y-3">
        {jobs.map((job) => (
          <div key={job.id} className="bg-ink2 border border-cream/10 rounded-2xl p-4">
            <div className="flex items-start justify-between gap-3 mb-2">
              <span className={`text-xs rounded-full px-3 py-1 ${PRINT_JOB_STATUS_STYLES[job.status]}`}>
                {PRINT_JOB_STATUS_LABELS[job.status]}
              </span>
              <span className="text-xs text-cream/50 shrink-0">{PRINT_DOCUMENT_TYPE_LABELS[job.documentType]}</span>
            </div>
            <p className="text-cream text-sm">{job.summary}</p>
            <p className="text-xs text-cream/50 mt-1">
              {job.attempts} attempt{job.attempts === 1 ? "" : "s"}
              {job.lastError && <span className="text-coral"> · {job.lastError}</span>}
            </p>
            {job.status !== "SENT" && (
              <div className="mt-3">
                <button
                  type="button"
                  onClick={() => handleRetry(job.id)}
                  disabled={retryingId === job.id}
                  className="w-full rounded-xl border border-cream/25 active:border-cream/50 transition-colors py-3 text-sm font-medium disabled:opacity-60"
                >
                  {retryingId === job.id ? "Retrying…" : "Retry"}
                </button>
                {retryErrors[job.id] && <p className="text-xs text-coral mt-1.5">{retryErrors[job.id]}</p>}
              </div>
            )}
          </div>
        ))}
        {jobs.length === 0 && (
          <p className="text-cream/50 text-sm">No print jobs{filter ? ` with status ${FILTER_LABELS[filter].toLowerCase()}` : ""}.</p>
        )}
      </div>
    </div>
  );
}
