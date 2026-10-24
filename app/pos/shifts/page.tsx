import { requireRoleAtLeast } from "@/lib/rbac";
import PosShiftPanel from "@/components/pos/PosShiftPanel";
import LongOpenShiftNotice from "@/components/LongOpenShiftNotice";
import { loadStaleShifts } from "@/lib/staleShiftsServer";

export default async function PosShiftsPage() {
  const user = await requireRoleAtLeast("CASHIER");
  const stale = await loadStaleShifts(user);

  return (
    <div>
      <div className="px-4 pt-4">
        <h1 className="font-display italic text-2xl">Shift</h1>
      </div>
      <div className="px-4 pt-4 empty:hidden">
        <LongOpenShiftNotice
          shifts={stale.shifts}
          now={stale.now}
          viewerUserId={user.id}
          viewerHasOwnShift={stale.viewerHasOwnShift}
          canCloseOthers={false}
          ownShiftHref="/pos/shifts"
          othersHref="/pos/shifts"
        />
      </div>
      {/* A no-login account (see lib/types.ts's UserCreateInput) can never reach requireRoleAtLeast -
          signing in at all requires an email - so this fallback is type-safety only, never real. */}
      <PosShiftPanel actorEmail={user.email ?? user.name} actorRole={user.role} />
    </div>
  );
}
