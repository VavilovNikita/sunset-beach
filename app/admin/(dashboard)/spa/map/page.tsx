import { backendJson, backendJsonOrDefault } from "@/lib/backendServer";
import { requireRoleAtLeast } from "@/lib/rbac";
import SpaTableMapView from "@/components/admin/SpaTableMapView";
import type { PropertyMap } from "@/lib/types";
import type { Table } from "@/lib/posTypes";

// PATCH /tables/positions is MANAGER+ on the backend, so unlike the property map (whose vacant/
// occupied/dirty/debt view is genuinely useful to CASHIER day to day) this whole page gates at
// MANAGER+ - a bare "where are the tables" pin map has no read-only value to front desk the way
// occupancy does, so there is no view-only mode to build here.
export default async function AdminSpaMapPage() {
  await requireRoleAtLeast("MANAGER", "/admin/pos");

  // Reuses the property map's own floor-plan image wholesale - same building, same grounds, and
  // it means a manager placing spa tables sees them against the same picture the rooms already
  // sit on ("the spa tables are over by the pool, not near the rooms") rather than uploading and
  // maintaining a second image of the same property. Only imagePath/imageUpdatedAt are read here;
  // replacing the image itself stays on the property map screen, the one place that owns it.
  const [propertyMap, tables] = await Promise.all([
    backendJson<PropertyMap>("/property-map", { auth: true }),
    backendJsonOrDefault<Table[]>("/tables", [], { auth: true }),
  ]);
  const spaTables = tables.filter((t) => t.zone === "SPA");

  return (
    <div>
      <p className="eyebrow text-sea mb-2">Front desk</p>
      <h1 className="font-display italic text-3xl mb-2">Spa table map</h1>
      <p className="text-xs text-cream/40 mb-6 max-w-2xl">
        Drag a table onto the plan (or back to the list) to place it, then save the layout. This is the same floor-plan
        image as the property map — replace it from that screen, not here.
      </p>

      <SpaTableMapView imagePath={propertyMap.imagePath} imageUpdatedAt={propertyMap.imageUpdatedAt} tables={spaTables} />
    </div>
  );
}
