import Link from "next/link";
import ShiftPanel from "@/components/admin/pos/ShiftPanel";
import { requireRoleAtLeast, hasRoleAtLeast } from "@/lib/rbac";

export default async function AdminShiftsPage() {
  // Opening/viewing/closing a shift is CASHIER+ on the backend — a WAITER
  // has no legitimate use for this page (same treatment as Printers).
  const user = await requireRoleAtLeast("CASHIER", "/admin/pos");
  const canExport = hasRoleAtLeast(user.role, "MANAGER");
  // GET /shifts (the till-reconciliation overview across staff/period) is MANAGER+, stricter
  // than this page's own CASHIER+ floor - same reasoning as canExport above.
  const canReviewAllShifts = canExport;

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <p className="eyebrow text-sea mb-2">POS</p>
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
      <ShiftPanel canExport={canExport} />
    </div>
  );
}
