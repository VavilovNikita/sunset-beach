// Shared client-side calls for POST/PATCH /tables (components/admin/pos/TableManager.tsx) -
// base CRUD only; PATCH /tables/positions has its own lib/tablePositionsClient.ts.
import { adminRequest, adminJsonInit } from "@/lib/adminFetch";
import type { Table, TableInput } from "@/lib/posTypes";

export type SaveTableResult = { ok: true; table: Table } | { ok: false; error: string };

export async function createTable(input: TableInput): Promise<SaveTableResult> {
  const result = await adminRequest<Table>("/tables", adminJsonInit("POST", input), "Could not create table.");
  if (!result.ok) return { ok: false, error: result.error };
  return { ok: true, table: result.data };
}

// PATCH is a full replace on this API, same as everywhere else - the whole TableInput goes out,
// not just the field that changed.
export async function updateTable(id: string, input: TableInput): Promise<SaveTableResult> {
  const result = await adminRequest<Table>(`/tables/${id}`, adminJsonInit("PATCH", input), "Could not save table.");
  if (!result.ok) return { ok: false, error: result.error };
  return { ok: true, table: result.data };
}
