// Shared client-side calls for GET/POST/DELETE /room-units/{id}/blocks. Mirrors
// lib/roomUnitHousekeepingClient.ts's exact pattern (same ok/error result shape, same
// adminRequest use) — replaces the raw fetch() calls AvailabilityManager.tsx used to make
// directly, which meant a backend failure there wasn't surfaced the way the rest of the app
// surfaces one.
import { adminRequest } from "@/lib/adminFetch";
import type { RoomUnitBlock, RoomUnitBlockInput, RoomUnitBlockResult } from "@/lib/types";

export type ListRoomUnitBlocksResult = { ok: true; blocks: RoomUnitBlock[] } | { ok: false; error: string };
export type CreateRoomUnitBlockResult = { ok: true; result: RoomUnitBlockResult } | { ok: false; error: string };
export type DeleteRoomUnitBlockResult = { ok: true } | { ok: false; error: string };

export async function listRoomUnitBlocks(roomUnitId: string): Promise<ListRoomUnitBlocksResult> {
  const result = await adminRequest<RoomUnitBlock[]>(`/room-units/${roomUnitId}/blocks`, undefined, "Could not load blocks.");
  if (!result.ok) return { ok: false, error: result.error };
  return { ok: true, blocks: result.data };
}

export async function createRoomUnitBlock(roomUnitId: string, input: RoomUnitBlockInput): Promise<CreateRoomUnitBlockResult> {
  const result = await adminRequest<RoomUnitBlockResult>(
    `/room-units/${roomUnitId}/blocks`,
    { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) },
    "Could not add block."
  );
  if (!result.ok) return { ok: false, error: result.error };
  return { ok: true, result: result.data };
}

export async function deleteRoomUnitBlock(roomUnitId: string, blockId: string): Promise<DeleteRoomUnitBlockResult> {
  const result = await adminRequest<unknown>(`/room-units/${roomUnitId}/blocks/${blockId}`, { method: "DELETE" }, "Could not remove block.");
  if (!result.ok) return { ok: false, error: result.error };
  return { ok: true };
}
