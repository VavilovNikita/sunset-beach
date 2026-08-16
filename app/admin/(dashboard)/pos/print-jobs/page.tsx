import Link from "next/link";
import { backendJson } from "@/lib/backendServer";
import { requireSessionUser } from "@/lib/rbac";
import PrintQueue from "@/components/admin/pos/PrintQueue";
import type { PrintJob } from "@/lib/posTypes";

// Any authenticated staff session — GET /print-jobs is WAITER+ on the
// backend, filtered server-side to the document types that role may see
// (WAITER/CASHIER: kitchen tickets and pre-bills only; MANAGER+: everything,
// including Z-reports and guest receipts). No extra role check here beyond
// requireSessionUser: the backend is already the enforcement point.
export default async function AdminPrintJobsPage() {
  await requireSessionUser();

  const jobs = await backendJson<PrintJob[]>("/print-jobs?status=FAILED", { auth: true });

  return (
    <div>
      <p className="eyebrow text-sea mb-2">POS</p>
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
      <PrintQueue initialJobs={jobs} initialFilter="FAILED" />
    </div>
  );
}
