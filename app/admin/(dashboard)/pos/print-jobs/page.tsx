import Link from "next/link";
import { loadNotPrintedJobs } from "@/lib/printQueueServer";
import { requireSessionUser } from "@/lib/rbac";
import PrintQueue from "@/components/admin/pos/PrintQueue";

// Reads the print queue with the visitor's session on every request - never prerendered at build
// (where there is no backend, and the load failure below printed an error into the build log).
export const dynamic = "force-dynamic";

// Any authenticated staff session — GET /print-jobs is WAITER+ on the
// backend, filtered server-side to the document types that role may see
// (WAITER/CASHIER: kitchen tickets and pre-bills only; MANAGER+: everything,
// including Z-reports and guest receipts). No extra role check here beyond
// requireSessionUser: the backend is already the enforcement point.
export default async function AdminPrintJobsPage() {
  await requireSessionUser();

  // Opens on "Not printed" (FAILED + still-retrying PENDING) - the same set the floor banner
  // counts, so the number there is the number of rows here. A failed first load is an error page
  // (as before), not an empty list.
  const jobs = await loadNotPrintedJobs();
  if (jobs === null) throw new Error("Could not load print jobs.");

  return (
    <div>
      <p className="eyebrow text-sea mb-2">Restaurant</p>
      <h1 className="font-display italic text-3xl mb-2">Print queue</h1>
      <p className="text-sm text-cream/60 mb-8 max-w-2xl">
        A failed job means a kitchen/bar ticket, pre-bill, receipt, or Z-report never reached its printer. Retry
        re-sends exactly what was originally queued — it won&rsquo;t regenerate the document from current data, so if
        the underlying printer setup changed, fix that first (see{" "}
        <Link href="/admin/pos/printers" className="text-sea hover:text-coral transition-colors underline underline-offset-4">
          Printers
        </Link>
        ).
      </p>
      <PrintQueue initialJobs={jobs} initialFilter="NOT_PRINTED" />
    </div>
  );
}
