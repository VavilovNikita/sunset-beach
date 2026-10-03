// Server-side first load for the /pos banner, the admin POS badge and both print queues: the
// "Not printed" set (FAILED + PENDING, see lib/printQueue.ts). `null` when either request fails -
// a restarting print backend must never take the floor board down, and "couldn't check" must
// never look like "nothing waiting".
import { backendJsonOrDefault } from "@/lib/backendServer";
import { mergePrintJobLists } from "@/lib/printQueue";
import type { PrintJob } from "@/lib/posTypes";

export async function loadNotPrintedJobs(): Promise<PrintJob[] | null> {
  const [failed, pending] = await Promise.all([
    backendJsonOrDefault<PrintJob[] | null>("/print-jobs?status=FAILED", null, { auth: true }),
    backendJsonOrDefault<PrintJob[] | null>("/print-jobs?status=PENDING", null, { auth: true }),
  ]);
  if (failed === null || pending === null) return null;
  return mergePrintJobLists([failed, pending]);
}
