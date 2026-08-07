import ShiftPanel from "@/components/admin/pos/ShiftPanel";
import { getSessionUser, hasRoleAtLeast } from "@/lib/rbac";

export default async function AdminShiftsPage() {
  const user = await getSessionUser();
  const canExport = !!user && hasRoleAtLeast(user.role, "MANAGER");

  return (
    <div>
      <p className="eyebrow text-sea mb-2">POS</p>
      <h1 className="font-display italic text-3xl mb-8">Shifts</h1>
      <ShiftPanel canExport={canExport} />
    </div>
  );
}
