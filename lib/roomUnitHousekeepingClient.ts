// Shared client-side call for PATCH /room-units/{id}/housekeeping — CASHIER+, a deliberately
// lower bar than the rest of /room-units (MANAGER+), since front desk is who actually flips
// this day to day. Independent of RoomUnitManager's label/isActive edit (MANAGER+) and of
// RoomUnitBlock (which pulls a unit off sale for a written reason, not a cleaning state).
import { adminRequest } from "@/lib/adminFetch";
import type { HousekeepingStatus, RoomUnit } from "@/lib/types";

export type UpdateHousekeepingResult = { ok: true; roomUnit: RoomUnit } | { ok: false; error: string };

export async function updateRoomUnitHousekeeping(roomUnitId: string, housekeepingStatus: HousekeepingStatus): Promise<UpdateHousekeepingResult> {
  const result = await adminRequest<RoomUnit>(
    `/room-units/${roomUnitId}/housekeeping`,
    { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ housekeepingStatus }) },
    "Could not update the room's cleaning status."
  );
  if (!result.ok) return { ok: false, error: result.error };
  return { ok: true, roomUnit: result.data };
}
