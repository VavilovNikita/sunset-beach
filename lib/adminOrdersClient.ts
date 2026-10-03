// Shared client-side calls for the admin POS floor board (components/admin/pos/OrderBoard.tsx).
// Routed through adminRequest rather than a bare fetch specifically so a failure surfaces as a
// real error instead of silently misbehaving: the raw fetch this replaced had no res.ok check
// on the read side (an error response would have been treated as Table[]/Order[] data) and, on
// the write side, checked res.ok but then just returned with no message on failure - a busy
// button would stop spinning and nothing else would happen, exactly the "say what happened"
// rule this project's own frontend CLAUDE.md exists to enforce.
import { adminRequest } from "@/lib/adminFetch";
import type { Order, Table } from "@/lib/posTypes";

export type FetchBoardResult = { ok: true; tables: Table[]; orders: Order[] } | { ok: false; error: string };

// Active orders are fetched as two single-status calls (status=OPEN, status=SENT) rather than
// one call for "everything ever" - the contract only documents a single `status` value per
// request, and this keeps the board from pulling the whole order history on every poll.
export async function fetchBoardData(): Promise<FetchBoardResult> {
  const [tablesRes, openRes, sentRes] = await Promise.all([
    adminRequest<Table[]>("/tables", undefined, "Could not load tables."),
    adminRequest<Order[]>("/orders?status=OPEN", undefined, "Could not load orders."),
    adminRequest<Order[]>("/orders?status=SENT", undefined, "Could not load orders."),
  ]);
  if (!tablesRes.ok) return tablesRes;
  if (!openRes.ok) return openRes;
  if (!sentRes.ok) return sentRes;
  return { ok: true, tables: tablesRes.data, orders: [...openRes.data, ...sentRes.data] };
}

// No create-on-open helpers here on purpose: a table's order is created together with its first
// item by the ticket screen (lib/posDraftOrder.ts), never when the table is tapped.
