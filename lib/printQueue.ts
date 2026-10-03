// One rule for "a print job that hasn't printed", shared by the /pos banner, the admin POS badge
// and both print queues - so the number on the banner is always the number of rows under the
// queue's default tab.
//
// The banner and the queue's "Failed" tab used to agree on paper (both asked GET /print-jobs for
// status=FAILED) and still disagreed in practice: a job only becomes FAILED after its last
// automatic attempt (5 by default, one a minute - PrintService on the backend), so for its first
// ~4 minutes an undelivered kitchen ticket is PENDING with a rising attempt count and appears on
// neither. Whichever screen was looked at a minute later showed a different answer. PENDING is
// already "the printer didn't take it": a successful first attempt goes straight to SENT, so a
// job sits in PENDING only after a failed attempt (or for the instant before its first one).
// Counting PENDING + FAILED is what "a ticket may not have reached the kitchen" actually means.
import type { PrintJob, PrintJobStatus } from "@/lib/posTypes";

export type PrintQueueFilter = "NOT_PRINTED" | PrintJobStatus | "";

export const PRINT_QUEUE_FILTERS: PrintQueueFilter[] = ["NOT_PRINTED", "FAILED", "PENDING", "SENT", ""];

export const PRINT_QUEUE_FILTER_LABELS: Record<PrintQueueFilter, string> = {
  NOT_PRINTED: "Not printed",
  FAILED: "Failed",
  PENDING: "Pending",
  SENT: "Sent",
  "": "All",
};

const NOT_PRINTED_STATUSES: PrintJobStatus[] = ["FAILED", "PENDING"];

// GET /print-jobs takes one status at a time; "Not printed" is two requests merged. `undefined`
// means no status filter (All).
export function statusesForFilter(filter: PrintQueueFilter): (PrintJobStatus | undefined)[] {
  if (filter === "NOT_PRINTED") return NOT_PRINTED_STATUSES;
  return [filter || undefined];
}

export function jobMatchesFilter(job: PrintJob, filter: PrintQueueFilter): boolean {
  if (filter === "") return true;
  if (filter === "NOT_PRINTED") return NOT_PRINTED_STATUSES.includes(job.status);
  return job.status === filter;
}

// Newest first, like the backend orders each list - and a job can't appear twice even if it
// moved from PENDING to FAILED between the two requests.
export function mergePrintJobLists(lists: PrintJob[][]): PrintJob[] {
  const byId = new Map<string, PrintJob>();
  for (const list of lists) for (const job of list) byId.set(job.id, job);
  return [...byId.values()].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
}

export type NotPrintedSummary = { total: number; retrying: number };

// Dismissed jobs are already left out by the backend's default list; filtered again here so a
// list fetched with includeDismissed can't inflate the count.
export function summarizeNotPrinted(jobs: PrintJob[]): NotPrintedSummary {
  const open = jobs.filter((j) => NOT_PRINTED_STATUSES.includes(j.status) && !j.dismissedAt);
  return { total: open.length, retrying: open.filter((j) => j.status === "PENDING").length };
}

export function notPrintedBannerText({ total, retrying }: NotPrintedSummary): string {
  const still = retrying > 0 ? ` (${retrying} still retrying)` : "";
  return `${total} print ${total === 1 ? "job" : "jobs"} not printed${still} — a ticket may not have reached the kitchen/bar`;
}

export function emptyPrintQueueText(filter: PrintQueueFilter): string {
  if (filter === "") return "No print jobs.";
  if (filter === "NOT_PRINTED") return "Nothing waiting — every print job has printed.";
  return `No print jobs with status ${PRINT_QUEUE_FILTER_LABELS[filter].toLowerCase()}.`;
}
