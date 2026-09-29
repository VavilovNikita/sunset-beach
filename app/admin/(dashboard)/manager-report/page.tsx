import Link from "next/link";
import { backendJson } from "@/lib/backendServer";
import { requireRoleAtLeast } from "@/lib/rbac";
import { parseNightAuditDateParam } from "@/lib/nightAudit";
import ManagerReportView from "@/components/admin/ManagerReportView";
import type { ManagerReport } from "@/lib/types";

// One night's room, guest, booking and room-revenue summary next to the same night last year (the
// scoped legacy Z370). GET /reports/manager is MANAGER+, same floor as the rest of /reports/* -
// unlike the CASHIER+ night audit and in-house list this sits beside in shape.
//
// With no ?date= the server picks today (hotel-local); the date picker just navigates to ?date=.
// Same param handling as the night-audit page. On-screen only - no export or print view.
export default async function ManagerReportPage({ searchParams }: { searchParams: { date?: string } }) {
  await requireRoleAtLeast("MANAGER");

  const date = parseNightAuditDateParam(searchParams.date);
  const report = await backendJson<ManagerReport>(date ? `/reports/manager?date=${date}` : "/reports/manager", { auth: true });

  return (
    <div className="max-w-4xl">
      <div className="mb-8">
        <p className="eyebrow text-sea mb-2">Reports</p>
        <h1 className="font-display italic text-3xl">Manager report</h1>
        <p className="text-sm text-cream/60 mt-3">
          One night&apos;s rooms, guests, bookings and room revenue, beside the same calendar date last year. Room
          revenue is the agreed room price, not money collected.
        </p>
      </div>

      <form method="get" className="flex items-end gap-3 mb-8">
        <div>
          <label className="eyebrow text-cream/60 block mb-1">Night of</label>
          <input
            type="date"
            name="date"
            defaultValue={report.date}
            className="bg-transparent border-b border-cream/25 py-2 text-cream text-sm focus:outline-none focus:border-coral"
          />
        </div>
        <button type="submit" className="rounded-full border border-cream/20 hover:border-coral px-4 py-2 text-sm">
          View
        </button>
        {date && (
          <Link href="/admin/manager-report" className="text-sm text-cream/60 hover:text-coral py-2">
            Today
          </Link>
        )}
      </form>

      <ManagerReportView report={report} />
    </div>
  );
}
