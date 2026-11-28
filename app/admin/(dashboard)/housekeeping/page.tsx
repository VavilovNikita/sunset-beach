import { backendJson } from "@/lib/backendServer";
import { requireRoleAtLeastOrFunction } from "@/lib/rbac";
import HousekeepingBoard from "@/components/admin/HousekeepingBoard";
import type { HousekeepingRoom } from "@/lib/types";

// Every physical room's cleaning state in one flat list, CASHIER+ or the HOUSEKEEPER job function (a deliberately
// lower bar than RoomUnitManager's label/isActive edit, MANAGER+). One read, GET /housekeeping/rooms: whether a room
// is occupied, arriving or due out, with nothing about the guest - so nothing here may link to a booking.
export default async function HousekeepingPage() {
  await requireRoleAtLeastOrFunction("CASHIER", "HOUSEKEEPER");

  const rooms = await backendJson<HousekeepingRoom[]>("/housekeeping/rooms", { auth: true });

  return (
    <div>
      <p className="eyebrow text-sea mb-2">Housekeeping</p>
      <h1 className="font-display italic text-3xl mb-8">Room status</h1>
      <HousekeepingBoard rooms={rooms} />
    </div>
  );
}
