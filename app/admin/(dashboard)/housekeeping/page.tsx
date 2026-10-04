import { backendJson } from "@/lib/backendServer";
import { requireRoleAtLeast } from "@/lib/rbac";
import HousekeepingBoard from "@/components/admin/HousekeepingBoard";
import { hotelDateKey } from "@/lib/hotelDate";
import type { PropertyMap, Room, RoomUnit } from "@/lib/types";

// Every physical room's cleaning state in one flat list, CASHIER+ (a deliberately lower bar
// than RoomUnitManager's label/isActive edit, MANAGER+ - see PATCH /room-units/{id}/housekeeping's
// own description). GET /room-units with no roomId returns every unit across every room type.
// Occupancy (the V/O half of VC/VD/OC/OD) comes from GET /property-map, also CASHIER+; if that read
// fails the board still works and shows clean/dirty only, saying occupancy is unavailable.
export default async function HousekeepingPage() {
  await requireRoleAtLeast("CASHIER", "/admin/pos");

  const [rooms, units, propertyMap] = await Promise.all([
    backendJson<Room[]>("/rooms", { auth: true }),
    backendJson<RoomUnit[]>("/room-units", { auth: true }),
    backendJson<PropertyMap>("/property-map", { auth: true }).catch(() => null),
  ]);

  return (
    <div>
      <p className="eyebrow text-sea mb-2">Housekeeping</p>
      <h1 className="font-display italic text-3xl mb-8">Room status</h1>
      <HousekeepingBoard rooms={rooms} units={units} occupancy={propertyMap?.units ?? null} today={hotelDateKey(new Date())} />
    </div>
  );
}
