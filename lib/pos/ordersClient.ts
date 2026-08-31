// Thin, typed wrappers around the order endpoints for the /pos section. Unlike the admin POS
// section (components/admin/pos/*), which hand-rolls fetch() inline in every component, every
// call here goes through posRequest so a dropped connection surfaces the same way everywhere —
// see lib/pos/posFetch.ts's comment for why that matters on a restaurant floor.
import { posRequest, posJsonInit, type PosResult } from "@/lib/pos/posFetch";
import type { CloseOrderInput, Order, OrderItemInput, PrintAttemptResult, Table } from "@/lib/posTypes";

export async function fetchBoardData(): Promise<PosResult<{ tables: Table[]; orders: Order[] }>> {
  const [tablesRes, openRes, sentRes] = await Promise.all([
    posRequest<Table[]>("/tables", undefined, "Could not load tables."),
    posRequest<Order[]>("/orders?status=OPEN", undefined, "Could not load orders."),
    posRequest<Order[]>("/orders?status=SENT", undefined, "Could not load orders."),
  ]);
  if (!tablesRes.ok) return tablesRes;
  if (!openRes.ok) return openRes;
  if (!sentRes.ok) return sentRes;
  return { ok: true, status: 200, data: { tables: tablesRes.data, orders: [...openRes.data, ...sentRes.data] } };
}

export function fetchOrder(orderId: string): Promise<PosResult<Order>> {
  return posRequest<Order>(`/orders/${orderId}`, undefined, "Could not load this order.");
}

export function createTableOrder(tableId: string): Promise<PosResult<Order>> {
  return posRequest<Order>("/orders", posJsonInit("POST", { tableId }), "Could not start an order for this table.");
}

export function createTicketOrder(guestName?: string): Promise<PosResult<Order>> {
  return posRequest<Order>("/orders", posJsonInit("POST", { guestName: guestName || undefined }), "Could not create a new ticket.");
}

// The backend accepts a batch (see OrderCreateInput in openapi.yaml) — sending a single-element
// array on every tap keeps the "tap an item, it's on the ticket" flow to one round trip per tap,
// with no client-side cart/staging step to lose track of.
export function addOrderItem(orderId: string, item: OrderItemInput): Promise<PosResult<Order>> {
  return posRequest<Order>(`/orders/${orderId}/items`, posJsonInit("POST", [item]), "Could not add this item.");
}

// PATCH .../items/{itemId} replaces the whole line (OrderItemInput - the same required shape as
// adding one), it does not patch just the field given - menuItemId/note must be sent back
// unchanged alongside the new quantity, or the backend rejects the missing required menuItemId.
export function updateOrderItemQuantity(
  orderId: string,
  itemId: string,
  menuItemId: string,
  quantity: number,
  note: string | null
): Promise<PosResult<Order>> {
  return posRequest<Order>(
    `/orders/${orderId}/items/${itemId}`,
    posJsonInit("PATCH", { menuItemId, quantity, note }),
    "Could not update the quantity."
  );
}

export function removeOrderItem(orderId: string, itemId: string): Promise<PosResult<Order>> {
  return posRequest<Order>(`/orders/${orderId}/items/${itemId}`, { method: "DELETE" }, "Could not remove this item.");
}

export function sendOrder(orderId: string): Promise<PosResult<Order>> {
  return posRequest<Order>(`/orders/${orderId}`, posJsonInit("PATCH", { status: "SENT" }), "Could not send this order.");
}

export function cancelOrder(orderId: string): Promise<PosResult<Order>> {
  return posRequest<Order>(`/orders/${orderId}/cancel`, { method: "POST" }, "Could not cancel this order.");
}

export function closeOrder(orderId: string, input: CloseOrderInput): Promise<PosResult<Order>> {
  return posRequest<Order>(`/orders/${orderId}/close`, posJsonInit("POST", input), "Could not close this order.");
}

export function printPrebill(orderId: string): Promise<PosResult<PrintAttemptResult>> {
  return posRequest<PrintAttemptResult>(`/orders/${orderId}/print-prebill`, { method: "POST" }, "Could not print the pre-bill.");
}
