"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ADMIN_API_URL } from "@/lib/backend";
import { usePolling } from "@/lib/usePolling";
import { PAYMENT_METHOD_LABELS, STATUS_LABELS, STATUS_STYLES, isTerminalStatus } from "@/lib/posOrders";
import AddOrderItemForm from "@/components/admin/pos/AddOrderItemForm";
import RoomChargeLink from "@/components/admin/pos/RoomChargeLink";
import type { Order, MenuItem, PaymentMethod } from "@/lib/posTypes";

export default function OrderTicket({ initialOrder, menu }: { initialOrder: Order; menu: MenuItem[] }) {
  const [order, setOrder] = useState(initialOrder);
  const [removingItemId, setRemovingItemId] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [closing, setClosing] = useState<PaymentMethod | null>(null);
  const [showRoomCharge, setShowRoomCharge] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // POST /orders/{id}/close requires the calling user to have an open shift
  // (Payment.shiftId is NOT NULL) — checked once on mount (a fresh mount
  // also happens naturally after navigating back from /admin/pos/shifts, so
  // there's no need to re-check on an interval or on window focus).
  const [hasOpenShift, setHasOpenShift] = useState<boolean | null>(null);
  // OrderItem only carries menuItemId (no denormalized name), so this is
  // built once from the menu fetched by the page and reused for every item
  // row instead of re-joining on each render.
  const menuById = useMemo(() => new Map(menu.map((m) => [m.id, m])), [menu]);
  // POST .../close returns the Order (status=PAID), not the Payment it
  // created — there's no endpoint to fetch that Payment back. The amount is
  // read from the response's order.total (the server always charges the
  // full total, no partial payment), while the method is whatever this
  // component itself just sent. Only reflects payments made in this
  // session; a reload after the fact won't reconstruct it.
  const [lastPayment, setLastPayment] = useState<{ method: PaymentMethod; amount: number } | null>(null);

  useEffect(() => {
    fetch(`${ADMIN_API_URL}/shifts/current`, { credentials: "include" })
      .then((res) => setHasOpenShift(res.ok))
      .catch(() => setHasOpenShift(false));
  }, []);

  async function refetch() {
    const res = await fetch(`${ADMIN_API_URL}/orders/${order.id}`, { credentials: "include" });
    if (res.ok) setOrder(await res.json());
  }

  // Stops once the order reaches a terminal status, so a ticket left open in
  // a background tab doesn't keep polling forever.
  usePolling(refetch, 3000, !isTerminalStatus(order.status));

  async function handleRemoveItem(itemId: string) {
    setRemovingItemId(itemId);
    const res = await fetch(`${ADMIN_API_URL}/orders/${order.id}/items/${itemId}`, {
      method: "DELETE",
      credentials: "include",
    });
    setRemovingItemId(null);
    if (res.ok) setOrder(await res.json());
  }

  async function handleSend() {
    setSending(true);
    setError(null);
    const res = await fetch(`${ADMIN_API_URL}/orders/${order.id}`, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "SENT" }),
    });
    setSending(false);
    if (!res.ok) {
      setError("Could not send order.");
      return;
    }
    setOrder(await res.json());
  }

  async function handleCancel() {
    if (!window.confirm("Cancel this order? This can't be undone.")) return;
    const res = await fetch(`${ADMIN_API_URL}/orders/${order.id}/cancel`, {
      method: "POST",
      credentials: "include",
    });
    if (res.ok) setOrder(await res.json());
  }

  async function handleClose(method: "CASH" | "CARD") {
    setClosing(method);
    setError(null);
    const res = await fetch(`${ADMIN_API_URL}/orders/${order.id}/close`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ method }),
    });
    setClosing(null);
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setError(data?.error ? JSON.stringify(data.error) : "Could not close order.");
      return;
    }
    const updated: Order = await res.json();
    setOrder(updated);
    setLastPayment({ method, amount: Number(updated.total) });
  }

  // Adding items is allowed for OPEN and SENT (a dispatched order can still
  // take a re-order); editing/removing an existing line is OPEN-only — once
  // sent, that line already went to the kitchen/bar and can't be walked back.
  const canAddItems = order.status === "OPEN" || order.status === "SENT";
  const canEditItems = order.status === "OPEN";
  const closable = order.status === "OPEN" || order.status === "SENT";

  return (
    <div className="grid lg:grid-cols-[1fr_320px] gap-8">
      <div>
        <div className="flex items-center gap-3 mb-6">
          <span className={`text-xs rounded-full px-3 py-1 ${STATUS_STYLES[order.status]}`}>
            {STATUS_LABELS[order.status]}
          </span>
          {order.bookingId && (
            <Link
              href={`/admin/bookings/${order.bookingId}`}
              className="text-xs text-sea hover:text-coral transition-colors"
            >
              Linked booking →
            </Link>
          )}
        </div>

        {order.status === "SENT" && (
          <p className="text-xs text-cream/50 bg-ink2/40 border border-cream/10 rounded-lg px-3 py-2 mb-4">
            This order was already sent — you&rsquo;re continuing an existing ticket. Sent lines can&rsquo;t be
            edited or removed, but you can still add more.
          </p>
        )}

        <div className="space-y-3 mb-8">
          {order.items.map((item) => (
            <div key={item.id} className="flex items-center gap-4 bg-ink2/40 border border-cream/10 rounded-xl p-4">
              <div className="flex-1 min-w-0">
                <p className="text-cream">
                  {item.quantity}× {menuById.get(item.menuItemId)?.name ?? "Unknown item"}
                </p>
                {item.note && <p className="text-xs text-cream/50">{item.note}</p>}
              </div>
              <p className="text-sm text-cream/70">
                ฿{(Number(item.unitPrice) * item.quantity).toLocaleString("en-US")}
              </p>
              {canEditItems && (
                <button
                  type="button"
                  onClick={() => handleRemoveItem(item.id)}
                  disabled={removingItemId === item.id}
                  className="text-sm text-cream/50 hover:text-coral transition-colors disabled:opacity-60"
                >
                  {removingItemId === item.id ? "Removing…" : "Remove"}
                </button>
              )}
            </div>
          ))}
          {order.items.length === 0 && <p className="text-cream/50 text-sm">No items yet.</p>}
        </div>

        {canAddItems && <AddOrderItemForm orderId={order.id} menuById={menuById} onAdded={setOrder} />}
      </div>

      <div className="space-y-6">
        <div className="bg-ink2/40 border border-cream/10 rounded-xl p-5">
          <p className="eyebrow text-cream/50 mb-1">Total</p>
          <p className="font-display italic text-2xl text-coral">฿{Number(order.total).toLocaleString("en-US")}</p>
          {lastPayment && (
            <p className="mt-2 text-xs text-cream/50">
              Paid via {PAYMENT_METHOD_LABELS[lastPayment.method]} — ฿{lastPayment.amount.toLocaleString("en-US")}
            </p>
          )}
        </div>

        {error && <p className="text-sm text-coral">{error}</p>}

        {canEditItems && (
          <button
            type="button"
            onClick={handleSend}
            disabled={sending || order.items.length === 0}
            className="w-full rounded-full bg-coral hover:bg-coraldeep transition-colors py-2.5 text-sm font-medium disabled:opacity-60"
          >
            {sending ? "Sending…" : "Send order"}
          </button>
        )}

        {closable && (
          <div className="space-y-2">
            <p className="eyebrow text-cream/50">Close order</p>
            {hasOpenShift === false ? (
              <p className="text-sm text-cream/60">
                Откройте смену, чтобы принимать оплату.{" "}
                <Link
                  href="/admin/pos/shifts"
                  className="text-sea hover:text-coral transition-colors underline underline-offset-4"
                >
                  Open shift →
                </Link>
              </p>
            ) : !showRoomCharge ? (
              <>
                <button
                  type="button"
                  onClick={() => handleClose("CASH")}
                  disabled={closing !== null || hasOpenShift !== true}
                  className="w-full rounded-full border border-cream/25 hover:border-cream/50 transition-colors py-2.5 text-sm font-medium disabled:opacity-60"
                >
                  {closing === "CASH" ? "Closing…" : "Cash"}
                </button>
                <button
                  type="button"
                  onClick={() => handleClose("CARD")}
                  disabled={closing !== null || hasOpenShift !== true}
                  className="w-full rounded-full border border-cream/25 hover:border-cream/50 transition-colors py-2.5 text-sm font-medium disabled:opacity-60"
                >
                  {closing === "CARD" ? "Closing…" : "Card"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowRoomCharge(true)}
                  disabled={closing !== null || hasOpenShift !== true}
                  className="w-full rounded-full border border-cream/25 hover:border-cream/50 transition-colors py-2.5 text-sm font-medium disabled:opacity-60"
                >
                  Charge to room
                </button>
              </>
            ) : (
              <RoomChargeLink
                orderId={order.id}
                onClose={() => setShowRoomCharge(false)}
                onSettled={(updated) => {
                  setOrder(updated);
                  setLastPayment({ method: "ROOM_CHARGE", amount: Number(updated.total) });
                  setShowRoomCharge(false);
                }}
              />
            )}
          </div>
        )}

        {closable && (
          <button
            type="button"
            onClick={handleCancel}
            className="w-full text-sm text-cream/50 hover:text-coral transition-colors"
          >
            Cancel order
          </button>
        )}
      </div>
    </div>
  );
}
