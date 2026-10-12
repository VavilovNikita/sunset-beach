import type { Order } from "@/lib/posTypes";

// Which open orders stand in the way of closing a shift. The backend's rule (ShiftService#close):
// an OPEN/SENT order opened by the shift's own cashier blocks the close; anyone else's open order
// does not - it is left open and reported back as Shift.warning. Orders carry no shiftId, so
// "this shift's" orders are the ones its cashier opened. This only sorts the lists the screen
// already fetched so the button and the notice agree with the server; the 409 stays the authority.
export function splitUnsettledOrders(
  orders: Order[],
  shiftOpenerId: string | undefined
): { blocking: Order[]; others: Order[] } {
  const blocking: Order[] = [];
  const others: Order[] = [];
  for (const order of orders) {
    (shiftOpenerId !== undefined && order.openedByUserId === shiftOpenerId ? blocking : others).push(order);
  }
  return { blocking, others };
}
