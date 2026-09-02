import { backendJson } from "@/lib/backendServer";
import { requireRoleAtLeast, hasRoleAtLeast } from "@/lib/rbac";
import PropertyMapView from "@/components/admin/PropertyMapView";
import type { PropertyMap } from "@/lib/types";

export default async function AdminPropertyMapPage() {
  // GET /property-map is CASHIER+ on the backend, same floor as GET /bookings/today - this is
  // the front desk's own screen. Placing rooms and replacing the background image are MANAGER+.
  const user = await requireRoleAtLeast("CASHIER", "/admin/pos");
  const canManage = hasRoleAtLeast(user.role, "MANAGER");

  const map = await backendJson<PropertyMap>("/property-map", { auth: true });

  return (
    <div>
      <p className="eyebrow text-sea mb-2">Front desk</p>
      <h1 className="font-display italic text-3xl mb-2">Property map</h1>
      <p className="text-xs text-cream/40 mb-6 max-w-2xl">
        Every room, where it actually sits on the property, colored by what&rsquo;s happening right now. The calendar
        answers what&rsquo;s coming up and Today answers what to do today — this is what&rsquo;s happening this
        instant.
        {canManage && " Drag a room onto the plan (or back to the list) to place it, then save the layout."}
      </p>

      <PropertyMapView initialMap={map} canManage={canManage} />
    </div>
  );
}
