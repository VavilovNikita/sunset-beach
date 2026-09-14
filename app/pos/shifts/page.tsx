import { requireRoleAtLeast } from "@/lib/rbac";
import PosShiftPanel from "@/components/pos/PosShiftPanel";

export default async function PosShiftsPage() {
  const user = await requireRoleAtLeast("CASHIER", "/pos");

  return (
    <div>
      <div className="px-4 pt-4">
        <h1 className="font-display italic text-2xl">Shift</h1>
      </div>
      {/* A no-login account (see lib/types.ts's UserCreateInput) can never reach requireRoleAtLeast -
          signing in at all requires an email - so this fallback is type-safety only, never real. */}
      <PosShiftPanel actorEmail={user.email ?? user.name} actorRole={user.role} />
    </div>
  );
}
