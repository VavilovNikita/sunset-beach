"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { usePolling } from "@/lib/usePolling";
import { orderNumberLabel } from "@/lib/posOrders";
import type { Order } from "@/lib/posTypes";

type Requester = <T>(path: string, init: RequestInit | undefined, fallbackError: string) => Promise<{ ok: true; data: T } | { ok: false }>;

// The backend refuses to close a shift while ANY order in the system is still OPEN/SENT
// (ShiftService#close - orders carry no shiftId, so the gate is system-wide). The desk used to
// find that out only after counting the drawer and pressing Close. This lists them up front, on
// both shift screens, and tells the panel whether the close button can work at all. Polled with
// the shift itself, so the list clears as tables are paid.
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

export default function UnsettledOrdersNotice({ orders, orderHref }: { orders: Order[]; orderHref: (id: string) => string }) {
  if (orders.length === 0) return null;
  return (
    <div className="text-sm text-coral bg-coral/10 border border-coral/30 rounded-lg px-3 py-2 space-y-1">
      <p>
        {orders.length} open order{orders.length === 1 ? "" : "s"} — close or cancel {orders.length === 1 ? "it" : "them"} before closing the
        shift:
      </p>
      <ul className="space-y-0.5">
        {orders.slice(0, 8).map((o) => (
          <li key={o.id}>
            <Link href={orderHref(o.id)} className="underline underline-offset-4">
              Order {orderNumberLabel(o)}
              {o.guestName ? ` · ${o.guestName}` : ""}
            </Link>
          </li>
        ))}
        {orders.length > 8 && <li className="text-coral/70">…and {orders.length - 8} more</li>}
      </ul>
    </div>
  );
}
