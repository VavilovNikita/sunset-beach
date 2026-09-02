import { backendJson } from "@/lib/backendServer";
import { requireRoleAtLeast } from "@/lib/rbac";
import HousekeepingBoard from "@/components/admin/HousekeepingBoard";
import type { Room, RoomUnit } from "@/lib/types";

// Every physical room's cleaning state in one flat list, CASHIER+ (a deliberately lower bar
// than RoomUnitManager's label/isActive edit, MANAGER+ - see PATCH /room-units/{id}/housekeeping's
// own description). GET /room-units with no roomId returns every unit across every room type.
export default async function HousekeepingPage() {
  await requireRoleAtLeast("CASHIER", "/admin/pos");

  const [rooms, units] = await Promise.all([
    backendJson<Room[]>("/rooms", { auth: true }),
    backendJson<RoomUnit[]>("/room-units", { auth: true }),
  ]);

  return (
    <div>
      <p className="eyebrow text-sea mb-2">Housekeeping</p>
      <h1 className="font-display italic text-3xl mb-8">Room status</h1>
      <HousekeepingBoard rooms={rooms} units={units} />
    </div>
  );
}
