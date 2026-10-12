"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { usePolling } from "@/lib/usePolling";
import { orderNumberLabel } from "@/lib/posOrders";
import { splitUnsettledOrders } from "@/lib/shiftOrders";
import type { Order } from "@/lib/posTypes";

type Requester = <T>(path: string, init: RequestInit | undefined, fallbackError: string) => Promise<{ ok: true; data: T } | { ok: false }>;

// The backend refuses to close a shift while an OPEN/SENT order opened by that shift's cashier is
// still there (ShiftService#close); other staff's open orders don't block it, they come back as a
// warning. The desk used to find that out only after counting the drawer and pressing Close. This
// lists them up front, on both shift screens (lib/shiftOrders.ts splits them), and tells the panel
// whether the close button can work at all. Polled with the shift itself, so the list clears as
// tables are paid.
export function useUnsettledOrders(request: Requester, active: boolean) {
  const [orders, setOrders] = useState<Order[] | null>(null);
  const refetch = useCallback(async () => {
    const [open, sent] = await Promise.all([
      request<Order[]>("/orders?status=OPEN", undefined, ""),
      request<Order[]>("/orders?status=SENT", undefined, ""),
    ]);
    // A failed read leaves the gate to the backend's own 409 rather than guessing "none".
    if (!open.ok || !sent.ok) return;
    setOrders([...open.data, ...sent.data]);
  }, [request]);
  useEffect(() => {
    if (active) refetch();
  }, [active, refetch]);
  usePolling(refetch, 20000, active);
  return orders;
}

export default function UnsettledOrdersNotice({
  orders,
  shiftOpenerId,
  orderHref,
}: {
  orders: Order[];
  // The shift's cashier: their open orders block the close, everyone else's only warn.
  shiftOpenerId: string | undefined;
  orderHref: (id: string) => string;
}) {
  const { blocking, others } = splitUnsettledOrders(orders, shiftOpenerId);
  if (blocking.length === 0 && others.length === 0) return null;
  return (
    <div className="space-y-2">
      {blocking.length > 0 && (
        <div className="text-sm text-coral bg-coral/10 border border-coral/30 rounded-lg px-3 py-2 space-y-1">
          <p>
            {blocking.length} of your open order{blocking.length === 1 ? "" : "s"} — close or cancel {blocking.length === 1 ? "it" : "them"} before
            closing the shift:
          </p>
          <OrderLinks orders={blocking} orderHref={orderHref} tone="text-coral/70" />
        </div>
      )}
      {others.length > 0 && (
        <div className="text-sm text-amber-400 bg-amber-400/10 border border-amber-400/30 rounded-lg px-3 py-2 space-y-1">
          <p>
            {others.length} open order{others.length === 1 ? "" : "s"} opened by other staff — {others.length === 1 ? "it stays" : "they stay"} open
            and {others.length === 1 ? "doesn" : "don"}&rsquo;t stop this shift from closing:
          </p>
          <OrderLinks orders={others} orderHref={orderHref} tone="text-amber-400/70" />
        </div>
      )}
    </div>
  );
}

function OrderLinks({ orders, orderHref, tone }: { orders: Order[]; orderHref: (id: string) => string; tone: string }) {
  return (
    <ul className="space-y-0.5">
      {orders.slice(0, 8).map((o) => (
        <li key={o.id}>
          <Link href={orderHref(o.id)} className="underline underline-offset-4">
            Order {orderNumberLabel(o)}
            {o.guestName ? ` · ${o.guestName}` : ""}
          </Link>
        </li>
      ))}
      {orders.length > 8 && <li className={tone}>…and {orders.length - 8} more</li>}
    </ul>
  );
}
