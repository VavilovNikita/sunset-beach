import { backendJson, backendJsonOrDefault } from "@/lib/backendServer";
import { requireRoleAtLeast } from "@/lib/rbac";
import GymBoard from "@/components/admin/GymBoard";
import GymSetupBanner from "@/components/admin/GymSetupBanner";
import type { GymDeviceList, GymStatus } from "@/lib/types";

// GET /gym/devices is CASHIER+ on the backend (switching a fan is front-desk work). Opening the page
// reads the relays' state once (the backend caches it for ~30 s); nothing refreshes it afterwards -
// the Tuya trial has a monthly call quota, so the board has a button instead of a timer.
export default async function AdminGymPage() {
  const user = await requireRoleAtLeast("CASHIER");

  // GET /gym/status answers from the server's configuration - no Tuya call - so the banner is there at once.
  const [list, status] = await Promise.all([
    backendJson<GymDeviceList>("/gym/devices", { auth: true }),
    backendJsonOrDefault<GymStatus | null>("/gym/status", null, { auth: true }),
  ]);

  return (
    <div>
      <p className="eyebrow text-sea mb-2">Front desk</p>
      <h1 className="font-display italic text-3xl mb-4">Gym</h1>
      <p className="text-sm text-cream/60 mb-6 max-w-2xl">
        Fans show their real state. An air conditioner's real state cannot be read — for those, the last command sent from this
        system is shown. The page does not refresh by itself: press Refresh.
      </p>
      <GymSetupBanner status={status} isAdmin={user.role === "ADMIN"} />
      <GymBoard initial={list} isAdmin={user.role === "ADMIN"} />
    </div>
  );
}
