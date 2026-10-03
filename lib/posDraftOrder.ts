// A POS order is only created together with its first line (POST /orders with `items`), never
// when a table is merely opened - tapping a free table and walking away used to leave an empty
// order holding the table as busy, which then got "closed" into a ฿0 payment in the history. Until
// the first item is added, the ticket screen is a draft that exists only in the URL: which table
// (or which walk-up ticket name) it's for.
export type DraftOrderTarget = { tableId: string | null; guestName: string | null };

export function draftOrderHref(basePath: string, target: { tableId?: string | null; guestName?: string | null }): string {
  const params = new URLSearchParams();
  if (target.tableId) params.set("tableId", target.tableId);
  if (target.guestName && target.guestName.trim()) params.set("guestName", target.guestName.trim());
  const query = params.toString();
  return `${basePath}/new${query ? `?${query}` : ""}`;
}

export function parseDraftTarget(searchParams: { tableId?: string; guestName?: string }): DraftOrderTarget {
  const tableId = searchParams.tableId?.trim() || null;
  const guestName = searchParams.guestName?.trim() || null;
  return { tableId, guestName };
}

// The body of the one POST /orders that creates the order and its first line together.
export function draftOrderBody(target: DraftOrderTarget, item: { menuItemId: string; quantity: number; note?: string | null }) {
  return {
    ...(target.tableId ? { tableId: target.tableId } : {}),
    ...(target.guestName ? { guestName: target.guestName } : {}),
    items: [{ menuItemId: item.menuItemId, quantity: item.quantity, note: item.note || null }],
  };
}
