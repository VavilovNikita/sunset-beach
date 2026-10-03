import { backendJson } from "@/lib/backendServer";
import { requireRoleAtLeast, hasRoleAtLeast } from "@/lib/rbac";
import { hotelDateKey } from "@/lib/hotelDate";
import { parseMonthParam, parseViewParam } from "@/lib/ratesGrid";
import RatesAvailabilityGrid from "@/components/admin/RatesAvailabilityGrid";
import type { Room } from "@/lib/types";

export default async function AdminRatesPage({ searchParams }: { searchParams: { month?: string; view?: string } }) {
  // GET /rooms, GET /pricing/{roomId} and GET /availability/{roomId} are all CASHIER+ - a CASHIER
  // quoting a walk-in needs both the price and whether a room is left. Setting a price
  // (PATCH /pricing/{roomId}) and the room block list are MANAGER+, gated inside the grid.
  const user = await requireRoleAtLeast("CASHIER", "/admin/pos");
  const canManage = hasRoleAtLeast(user.role, "MANAGER");
  const rooms = await backendJson<Room[]>("/rooms", { auth: true });

  const todayKey = hotelDateKey(new Date());
  const month = parseMonthParam(searchParams.month, todayKey);
  const view = parseViewParam(searchParams.view);

  return (
    <div>
      <p className="eyebrow text-sea mb-2">Rates</p>
      <h1 className="font-display italic text-3xl mb-8">Rates &amp; availability</h1>

      {rooms.length === 0 ? (
        <p className="text-cream/50 text-sm">Add a room first.</p>
      ) : (
        <RatesAvailabilityGrid
          rooms={rooms.map((r) => ({ id: r.id, name: r.name }))}
          canManage={canManage}
          month={month}
          view={view}
          todayKey={todayKey}
        />
      )}
    </div>
  );
}
