import Link from "next/link";
import ShiftPanel from "@/components/admin/pos/ShiftPanel";
import LongOpenShiftNotice from "@/components/LongOpenShiftNotice";
import { loadStaleShifts } from "@/lib/staleShiftsServer";
import { requireRoleAtLeast, hasRoleAtLeast } from "@/lib/rbac";

export default async function AdminShiftsPage() {
  // Opening/viewing/closing a shift is CASHIER+ on the backend — a WAITER
  // has no legitimate use for this page (same treatment as Printers).
  const user = await requireRoleAtLeast("CASHIER");
  const canExport = hasRoleAtLeast(user.role, "MANAGER");
  // GET /shifts (the till-reconciliation overview across staff/period) is MANAGER+, stricter
  // than this page's own CASHIER+ floor - same reasoning as canExport above.
  const canReviewAllShifts = canExport;
  const stale = await loadStaleShifts(user);

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <p className="eyebrow text-sea mb-2">Restaurant</p>
          <h1 className="font-display italic text-3xl">Shifts</h1>
        </div>
        {canReviewAllShifts && (
          <Link
            href="/admin/pos/shifts/history"
            className="text-sm text-sea hover:text-coral transition-colors underline underline-offset-4"
          >
            Review all shifts →
          </Link>
        )}
      </div>
      {/* Says whose old shift is still open and what to do - the form below is only ever about the reader's own shift. */}
      <LongOpenShiftNotice
        shifts={stale.shifts}
        now={stale.now}
        viewerUserId={user.id}
        viewerHasOwnShift={stale.viewerHasOwnShift}
        canCloseOthers={stale.isManager}
        ownShiftHref="/admin/pos/shifts"
        othersHref="/admin/pos/shifts/history"
      />
      <ShiftPanel canExport={canExport} />
    </div>
  );
}
