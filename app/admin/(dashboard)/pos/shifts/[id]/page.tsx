import Link from "next/link";
import { notFound } from "next/navigation";
import { backendJson } from "@/lib/backendServer";
import { ADMIN_API_URL, BackendError } from "@/lib/backend";
import { requireRoleAtLeast, hasRoleAtLeast } from "@/lib/rbac";
import StatCard from "@/components/admin/StatCard";
import type { ShiftSummary } from "@/lib/posTypes";

export default async function ShiftReportPage({ params }: { params: { id: string } }) {
  // GET /shifts/{id} is CASHIER+ on the backend.
  const user = await requireRoleAtLeast("CASHIER", "/admin/pos");

  let shift: ShiftSummary;
  try {
    shift = await backendJson<ShiftSummary>(`/shifts/${params.id}`, { auth: true });
  } catch (e) {
    if (e instanceof BackendError && e.status === 404) notFound();
    throw e;
  }

  // GET /shifts/{id}/export requires MANAGER+, but this page (and the
  // "current shift" one) can be reached by a CASHIER too — hide the link
  // rather than let them hit a 403.
  const canExport = hasRoleAtLeast(user.role, "MANAGER");

  return (
    <div>
      <p className="eyebrow text-sea mb-2">POS</p>
      <h1 className="font-display italic text-3xl mb-2">Shift report</h1>
      <p className="text-sm text-cream/50 mb-8">
        {shift.openedAt.slice(0, 16).replace("T", " ")} —{" "}
        {shift.closedAt ? shift.closedAt.slice(0, 16).replace("T", " ") : "open"}
      </p>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
        <StatCard label="Cash" value={`฿${Number(shift.totals.cash).toLocaleString("en-US")}`} />
        <StatCard label="Card" value={`฿${Number(shift.totals.card).toLocaleString("en-US")}`} />
        <StatCard label="Room charge" value={`฿${Number(shift.totals.roomCharge).toLocaleString("en-US")}`} />
        <StatCard label="Payments" value={String(shift.totals.paymentCount)} />
      </div>

      {shift.notes && (
        <p className="text-sm text-cream/60 mb-6">
          <span className="text-cream/40">Notes:</span> {shift.notes}
        </p>
      )}

      {/* Both MANAGER+-gated (GET /shifts/{id}/export and the /admin/pos/orders review list) -
          hidden together for a CASHIER viewing their own shift, same reasoning as Export CSV. */}
      {canExport && (
        <div className="flex flex-wrap items-center gap-4">
          <a
            href={`${ADMIN_API_URL}/shifts/${shift.id}/export`}
            className="inline-block rounded-full border border-cream/25 hover:border-cream/50 transition-colors px-5 py-2.5 text-sm font-medium"
          >
            Export CSV
          </a>
          <Link
            href={`/admin/pos/orders?shiftId=${shift.id}`}
            className="text-sm text-sea hover:text-coral transition-colors underline underline-offset-4"
          >
            Orders in this shift →
          </Link>
        </div>
      )}
    </div>
  );
}
