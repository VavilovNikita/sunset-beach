import { posRequest, posJsonInit, type PosResult } from "@/lib/pos/posFetch";
import type { DismissPrintJobsInput, PrintJob, PrintJobStatus } from "@/lib/posTypes";

// The backend already scopes what comes back to the caller's role (WAITER/CASHIER only ever see
// KITCHEN_TICKET/BAR_TICKET/PREBILL failures; MANAGER+ sees everything, including Z-reports and
// guest receipts — PrinterService#isVisible) — this renders exactly what it's given, no
// client-side filtering on top of that policy. Dismissed jobs are excluded server-side by
// default too (see dismissPrintJobs below) - pass includeDismissed to see them anyway.
export function fetchPrintJobs(status?: PrintJobStatus, includeDismissed?: boolean): Promise<PosResult<PrintJob[]>> {
  const params = new URLSearchParams();
  if (status) params.set("status", status);
  if (includeDismissed) params.set("includeDismissed", "true");
  const query = params.toString();
  return posRequest<PrintJob[]>(`/print-jobs${query ? `?${query}` : ""}`, undefined, "Could not load print jobs.");
}

export function retryPrintJob(id: string): Promise<PosResult<PrintJob>> {
  return posRequest<PrintJob>(`/print-jobs/${id}/retry`, { method: "POST" }, "Could not retry this job.");
}

// Closes one or more FAILED jobs as not-actionable (printer replaced, order already reached the
// guest, kitchen told by voice) - never deletes them, just marks them and drops them out of the
// default list/badge count. A single job is just `ids: [id]`. All-or-nothing across the batch.
export function dismissPrintJobs(ids: string[], note?: string): Promise<PosResult<PrintJob[]>> {
  const body: DismissPrintJobsInput = note ? { ids, note } : { ids };
  return posRequest<PrintJob[]>("/print-jobs/dismiss", posJsonInit("POST", body), "Could not dismiss these jobs.");
}
