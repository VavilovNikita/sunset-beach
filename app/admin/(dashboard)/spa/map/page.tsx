import { backendJson, backendJsonOrDefault } from "@/lib/backendServer";
import { requireRoleAtLeast } from "@/lib/rbac";
import SpaTableMapView from "@/components/admin/SpaTableMapView";
import type { SpaMap, Table } from "@/lib/posTypes";

// PATCH /tables/positions is MANAGER+ on the backend, so unlike the property map (whose vacant/
// occupied/dirty/debt view is genuinely useful to CASHIER day to day) this whole page gates at
// MANAGER+ - a bare "where are the tables" pin map has no read-only value to front desk the way
// occupancy does, so there is no view-only mode to build here.
export default async function AdminSpaMapPage() {
  await requireRoleAtLeast("MANAGER", "/admin/pos");

  // The spa's own floor-plan image (GET /spa-map), not the property map's - the spa is a
  // separate physical layout at a separate scale from the hotel's rooms, and this screen now
  // owns uploading/replacing it directly (see SpaTableMapView's own upload form), the same way
  // the property map screen owns its own image.
  const [spaMap, tables] = await Promise.all([
    backendJson<SpaMap>("/spa-map", { auth: true }),
    backendJsonOrDefault<Table[]>("/tables", [], { auth: true }),
  ]);
  const spaTables = tables.filter((t) => t.zone === "SPA");

  return (
    <div>
      <p className="eyebrow text-sea mb-2">Front desk</p>
      <h1 className="font-display italic text-3xl mb-2">Spa table map</h1>
      <p className="text-xs text-cream/40 mb-6 max-w-2xl">
        Drag a table onto the plan (or back to the list) to place it, then save the layout.
      </p>

      <SpaTableMapView imagePath={spaMap.imagePath} imageUpdatedAt={spaMap.imageUpdatedAt} tables={spaTables} />
    </div>
  );
}
