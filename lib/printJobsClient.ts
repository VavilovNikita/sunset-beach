// Shared client-side calls for GET/POST /print-jobs (components/admin/pos/PrintQueue.tsx,
// FailedPrintJobsBadge.tsx). Routed through adminRequest rather than a bare fetch: PrintQueue's
// own refetch had a res.ok check but no error state at all on failure - a failed poll or filter
// change left the stale list on screen with zero feedback that anything had gone wrong.
import { adminRequest, adminJsonInit } from "@/lib/adminFetch";
import type { DismissPrintJobsInput, PrintJob, PrintJobStatus, PrintDocumentType } from "@/lib/posTypes";

export type FetchPrintJobsResult = { ok: true; jobs: PrintJob[] } | { ok: false; error: string };
export type RetryPrintJobResult = { ok: true; job: PrintJob } | { ok: false; error: string };
export type DismissPrintJobsResult = { ok: true; jobs: PrintJob[] } | { ok: false; error: string };

export async function fetchPrintJobs(
  filter?: PrintJobStatus | "",
  docTypeFilter?: PrintDocumentType | "",
  includeDismissed?: boolean
): Promise<FetchPrintJobsResult> {
  const params = new URLSearchParams();
  if (filter) params.set("status", filter);
  if (docTypeFilter) params.set("documentType", docTypeFilter);
  if (includeDismissed) params.set("includeDismissed", "true");
  const query = params.toString();
  const result = await adminRequest<PrintJob[]>(`/print-jobs${query ? `?${query}` : ""}`, undefined, "Could not load print jobs.");
  if (!result.ok) return { ok: false, error: result.error };
  return { ok: true, jobs: result.data };
}

export async function retryPrintJob(id: string): Promise<RetryPrintJobResult> {
  const result = await adminRequest<PrintJob>(`/print-jobs/${id}/retry`, adminJsonInit("POST"), "Could not retry this job.");
  if (!result.ok) return { ok: false, error: result.error };
  return { ok: true, job: result.data };
}

export async function dismissPrintJobs(ids: string[]): Promise<DismissPrintJobsResult> {
  const body: DismissPrintJobsInput = { ids };
  const result = await adminRequest<PrintJob[]>("/print-jobs/dismiss", adminJsonInit("POST", body), "Could not dismiss these jobs.");
  if (!result.ok) return { ok: false, error: result.error };
  return { ok: true, jobs: result.data };
}
