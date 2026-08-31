import ShiftPanel from "@/components/admin/pos/ShiftPanel";
import { requireRoleAtLeast, hasRoleAtLeast } from "@/lib/rbac";

export default async function AdminShiftsPage() {
  // Opening/viewing/closing a shift is CASHIER+ on the backend — a WAITER
  // has no legitimate use for this page (same treatment as Printers).
  const user = await requireRoleAtLeast("CASHIER", "/admin/pos");
  const canExport = hasRoleAtLeast(user.role, "MANAGER");

  return (
    <div>
      <p className="eyebrow text-sea mb-2">POS</p>
      <h1 className="font-display italic text-3xl mb-8">Shifts</h1>
      <ShiftPanel canExport={canExport} />
    </div>
  );
}
