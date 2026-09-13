import { backendJson } from "@/lib/backendServer";
import { requireRoleAtLeast, hasRoleAtLeast } from "@/lib/rbac";
import SpaTableMapView from "@/components/admin/SpaTableMapView";
import type { SpaMap } from "@/lib/posTypes";

// GET /spa-map is CASHIER+ on the backend, same floor as GET /spa-appointments - a receptionist
// reading which table is free right now is exactly the reader that mattered once the map started
// carrying busy/free/next-appointment state, not the exception this page used to assume didn't
// exist. Placing tables and replacing the background image stay MANAGER+.
export default async function AdminSpaMapPage() {
  const user = await requireRoleAtLeast("CASHIER", "/admin/pos");
  const canManage = hasRoleAtLeast(user.role, "MANAGER");

  // Every SPA-zone table, already enriched with today's occupancy - see SpaMapTable's own
  // openapi.yaml description for where that's computed and what it costs. No separate GET
  // /tables call any more; this one response is now everything the screen needs.
  const spaMap = await backendJson<SpaMap>("/spa-map", { auth: true });

  return (
    <div>
      <p className="eyebrow text-sea mb-2">Front desk</p>
      <h1 className="font-display italic text-3xl mb-2">Spa table map</h1>
      <p className="text-xs text-cream/40 mb-6 max-w-2xl">
        Sea is free, dark is busy right now, dim is deactivated. Double-click a table (tap once on a touchscreen)
        for its today.
        {canManage && " Drag a table onto the plan (or back to the list) to place it, then save the layout."}
      </p>

      <SpaTableMapView imagePath={spaMap.imagePath} imageUpdatedAt={spaMap.imageUpdatedAt} tables={spaMap.tables} canManage={canManage} />
    </div>
  );
}
