import Link from "next/link";
import { backendJson } from "@/lib/backendServer";
import { getSessionUser, hasRoleAtLeast } from "@/lib/rbac";
import RestaurantTableMapView from "@/components/admin/pos/RestaurantTableMapView";
import type { RestaurantMap } from "@/lib/posTypes";

// GET /restaurant-map is open to any staff role, same floor as GET /tables and the POS board
// itself - a waiter finding a table is exactly who reads this. Placing tables and replacing the
// background image are MANAGER+ (PATCH /tables/positions, POST /restaurant-map/image).
export default async function AdminPosMapPage() {
  const [user, restaurantMap] = await Promise.all([
    getSessionUser(),
    backendJson<RestaurantMap>("/restaurant-map", { auth: true }),
  ]);
  const canManage = !!user && hasRoleAtLeast(user.role, "MANAGER");

  return (
    <div>
      <div className="flex items-center justify-between gap-4 flex-wrap mb-2">
        <div>
          <p className="eyebrow text-sea mb-2">Restaurant</p>
          <h1 className="font-display italic text-3xl">Floor map</h1>
        </div>
        <Link href="/admin/pos" className="text-sm text-sea hover:text-coral transition-colors underline underline-offset-4">
          ← Tables list
        </Link>
      </div>
      <p className="text-xs text-cream/40 mb-6 max-w-2xl">
        Sea is free, dark has an open order, dim is deactivated. Double-click a table (tap once on a touchscreen) to open
        its order, or start one.
        {canManage && " Drag a table onto the plan (or back to the list) to place it, then save the layout."}
      </p>

      <RestaurantTableMapView initialMap={restaurantMap} canManage={canManage} />
    </div>
  );
}
