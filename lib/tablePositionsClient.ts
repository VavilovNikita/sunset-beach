// Shared client-side call for PATCH /tables/positions - mirrors
// lib/propertyMapClient.ts's saveRoomUnitPositions exactly (batch, all-or-nothing).
import { adminRequest, adminJsonInit } from "@/lib/adminFetch";
import type { Table, TablePositionInput } from "@/lib/posTypes";

export type SaveTablePositionsResult = { ok: true; tables: Table[] } | { ok: false; error: string };

export async function saveTablePositions(inputs: TablePositionInput[]): Promise<SaveTablePositionsResult> {
  const result = await adminRequest<Table[]>("/tables/positions", adminJsonInit("PATCH", inputs), "Could not save table positions.");
  if (!result.ok) return { ok: false, error: result.error };
  return { ok: true, tables: result.data };
}
