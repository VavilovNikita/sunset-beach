import { posRequest, type PosResult } from "@/lib/pos/posFetch";
import type { PrintJob, PrintJobStatus } from "@/lib/posTypes";

// The backend already scopes what comes back to the caller's role (WAITER/CASHIER only ever see
// KITCHEN_TICKET/BAR_TICKET/PREBILL failures; MANAGER+ sees everything, including Z-reports and
// guest receipts — PrinterService#isVisible) — this renders exactly what it's given, no
// client-side filtering on top of that policy.
export function fetchPrintJobs(status?: PrintJobStatus): Promise<PosResult<PrintJob[]>> {
  const query = status ? `?status=${status}` : "";
  return posRequest<PrintJob[]>(`/print-jobs${query}`, undefined, "Could not load print jobs.");
}

export function retryPrintJob(id: string): Promise<PosResult<PrintJob>> {
  return posRequest<PrintJob>(`/print-jobs/${id}/retry`, { method: "POST" }, "Could not retry this job.");
}
