import { backendJson, backendJsonOrDefault } from "@/lib/backendServer";
import { requireRoleAtLeast } from "@/lib/rbac";
import LightingBoard from "@/components/admin/LightingBoard";
import LightingSetupBanner from "@/components/admin/LightingSetupBanner";
import type { LightingDeviceList, LightingStatus } from "@/lib/types";

// GET /lighting/devices is MANAGER+ on the backend (SecurityConfig.LIGHTING_CONTROL_ROLE). Opening the page reads
// every active controller once, in parallel (the backend caches it for ~10 s); nothing refreshes it afterwards
// except the Refresh button and the tab coming back into view - no timer.
export default async function AdminLightingPage() {
  const user = await requireRoleAtLeast("MANAGER");
  const isAdmin = user.role === "ADMIN";

  // GET /lighting/status answers from the server's configuration - no call to a controller - so the banner is
  // there at once, and an unconfigured server is never asked for the list at all.
  const status = await backendJsonOrDefault<LightingStatus | null>("/lighting/status", null, { auth: true });
  const list = status?.configured === false ? null : await backendJson<LightingDeviceList>("/lighting/devices", { auth: true });

  return (
    <div>
      <p className="eyebrow text-sea mb-2">Gym &amp; lighting</p>
      <h1 className="font-display italic text-3xl mb-4">Lighting</h1>
      <p className="text-sm text-cream/60 mb-2 max-w-2xl">
        Switch the lights, set the brightness or apply a preset stored on the controller. The page does not refresh by itself: press Refresh.
      </p>
      <p className="text-xs text-cream/50 mb-6 max-w-2xl">Brightness 0 % switches the lights off - that is how the controllers treat it.</p>
      {list ? <LightingBoard initial={list} isAdmin={isAdmin} /> : <LightingSetupBanner isAdmin={isAdmin} />}
    </div>
  );
}
