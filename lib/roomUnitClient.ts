// Shared client-side calls for POST/PATCH /room-units (components/admin/RoomUnitManager.tsx) -
// base label/isActive CRUD only; housekeeping status and manual blocks have their own
// lib/roomUnitHousekeepingClient.ts and lib/roomUnitBlockClient.ts.
import { adminRequest, adminJsonInit } from "@/lib/adminFetch";
import type { RoomUnit, RoomUnitInput } from "@/lib/types";

export type SaveRoomUnitResult = { ok: true; unit: RoomUnit } | { ok: false; error: string };

export async function createRoomUnit(input: RoomUnitInput): Promise<SaveRoomUnitResult> {
  const result = await adminRequest<RoomUnit>("/room-units", adminJsonInit("POST", input), "Could not create room.");
  if (!result.ok) return { ok: false, error: result.error };
  return { ok: true, unit: result.data };
}

// PATCH is a full replace, same convention as TableManager/PrinterManager.
export async function updateRoomUnit(id: string, input: RoomUnitInput): Promise<SaveRoomUnitResult> {
  const result = await adminRequest<RoomUnit>(`/room-units/${id}`, adminJsonInit("PATCH", input), "Could not save room.");
  if (!result.ok) return { ok: false, error: result.error };
  return { ok: true, unit: result.data };
}
