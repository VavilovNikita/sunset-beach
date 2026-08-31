import { requireRoleAtLeast } from "@/lib/rbac";
import PosShiftPanel from "@/components/pos/PosShiftPanel";

export default async function PosShiftsPage() {
  const user = await requireRoleAtLeast("CASHIER", "/pos");

  return (
    <div>
      <div className="px-4 pt-4">
        <h1 className="font-display italic text-2xl">Shift</h1>
      </div>
      <PosShiftPanel actorEmail={user.email} actorRole={user.role} />
    </div>
  );
}
