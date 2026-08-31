"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePolling } from "@/lib/usePolling";
import { PAYMENT_METHOD_LABELS, STATUS_LABELS, STATUS_STYLES, isTerminalStatus } from "@/lib/posOrders";
import { fetchOrder, updateOrderItemQuantity, removeOrderItem, sendOrder, cancelOrder, closeOrder, printPrebill } from "@/lib/pos/ordersClient";
import { fetchCurrentShift } from "@/lib/pos/shiftsClient";
import PosMenuPicker from "@/components/pos/PosMenuPicker";
import PosRoomChargeSearch from "@/components/pos/PosRoomChargeSearch";
import PosAttributedConfirm from "@/components/pos/PosAttributedConfirm";
import type { Role } from "@/lib/session";
import type { Order, MenuItem, PaymentMethod, PrintAttemptResult } from "@/lib/posTypes";

const ROLE_LABELS: Record<Role, string> = { WAITER: "Waiter", CASHIER: "Cashier", MANAGER: "Manager", ADMIN: "Admin" };

export default function PosOrderTicket({
  initialOrder,
  menu,
  canManagePayments,
  actorEmail,
  actorRole,
}: {
  initialOrder: Order;
  menu: MenuItem[];
  canManagePayments: boolean;
  // Whoever is currently logged in - shown back at the moment cash/card payment is confirmed
  // (see PosAttributedConfirm) so a swapped identity is caught before it's recorded, not after.
  actorEmail: string;
  actorRole: Role;
}) {
  const [order, setOrder] = useState(initialOrder);
  const [busyItemId, setBusyItemId] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [confirmingMethod, setConfirmingMethod] = useState<"CASH" | "CARD" | null>(null);
  const [closingMethod, setClosingMethod] = useState<PaymentMethod | null>(null);
  const [showRoomCharge, setShowRoomCharge] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasOpenShift, setHasOpenShift] = useState<boolean | null>(null);
  const [lastPayment, setLastPayment] = useState<{ method: PaymentMethod; amount: number } | null>(null);
  const [printingPrebill, setPrintingPrebill] = useState(false);
  const [prebillResult, setPrebillResult] = useState<PrintAttemptResult | null>(null);
  const [prebillError, setPrebillError] = useState<string | null>(null);

  const menuById = useMemo(() => new Map(menu.map((m) => [m.id, m])), [menu]);

  useEffect(() => {
    if (!canManagePayments) return;
    fetchCurrentShift().then((result) => setHasOpenShift(result.ok && result.data !== null));
  }, [canManagePayments]);

  async function refetch() {
    const result = await fetchOrder(order.id);
    if (result.ok) setOrder(result.data);
  }

  usePolling(refetch, 3000, !isTerminalStatus(order.status));

  async function handleQuantityChange(item: Order["items"][number], nextQuantity: number) {
    if (nextQuantity < 1) return;
    setBusyItemId(item.id);
    setError(null);
    const result = await updateOrderItemQuantity(order.id, item.id, item.menuItemId, nextQuantity, item.note);
    setBusyItemId(null);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setOrder(result.data);
  }

  async function handleRemoveItem(itemId: string) {
    setBusyItemId(itemId);
    setError(null);
    const result = await removeOrderItem(order.id, itemId);
    setBusyItemId(null);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setOrder(result.data);
  }

  async function handleSend() {
    setSending(true);
    setError(null);
    const result = await sendOrder(order.id);
    setSending(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setOrder(result.data);
  }

  async function handleCancel() {
    if (!window.confirm("Cancel this order? This can't be undone.")) return;
    setError(null);
    const result = await cancelOrder(order.id);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setOrder(result.data);
  }

  async function handlePrintPrebill() {
    setPrintingPrebill(true);
    setPrebillResult(null);
    setPrebillError(null);
    const result = await printPrebill(order.id);
    setPrintingPrebill(false);
    if (!result.ok) {
      setPrebillError(result.error);
      return;
    }
    setPrebillResult(result.data);
  }

  async function handleClose(method: "CASH" | "CARD") {
    setClosingMethod(method);
    setError(null);
    const result = await closeOrder(order.id, { method });
    setClosingMethod(null);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setConfirmingMethod(null);
    setOrder(result.data);
    setLastPayment({ method, amount: Number(result.data.total) });
  }

  // Same rule as the admin ticket, unchanged: a dispatched order can still take a re-order
  // (canAddItems), but an existing line that may already be in the kitchen can't be walked back
  // (canEditItems is OPEN-only).
  const canAddItems = order.status === "OPEN" || order.status === "SENT";
  const canEditItems = order.status === "OPEN";
  const closable = order.status === "OPEN" || order.status === "SENT";

  return (
    <div className="p-4 space-y-6">
      <div className="flex items-center gap-3 flex-wrap">
        <span className={`text-sm rounded-full px-3 py-1.5 ${STATUS_STYLES[order.status]}`}>{STATUS_LABELS[order.status]}</span>
        <span className="font-display italic text-2xl text-coral ml-auto">
          ฿{Number(order.total).toLocaleString("en-US")}
        </span>
      </div>

      {order.status === "SENT" && (
        <p className="text-sm text-cream/50 bg-ink2 border border-cream/10 rounded-xl px-4 py-3">
          Already sent — sent lines can&rsquo;t be edited or removed, but you can still add more.
        </p>
      )}

      {lastPayment && (
        <p className="text-sm text-cream/50">
          Paid via {PAYMENT_METHOD_LABELS[lastPayment.method]} — ฿{lastPayment.amount.toLocaleString("en-US")}
        </p>
      )}

      {/* Suppressed here while the payment confirm card is open — it already surfaces `error`
          itself, right next to the retry button, instead of at the top of a ticket that may be
          scrolled well past by then. */}
      {error && !confirmingMethod && <p className="text-sm text-coral">{error}</p>}

      <div className="space-y-2.5">
        {order.items.map((item) => (
          <div key={item.id} className="bg-ink2 border border-cream/10 rounded-2xl p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-cream">{menuById.get(item.menuItemId)?.name ?? "Unknown item"}</p>
                {item.note && <p className="text-xs text-cream/50 mt-0.5">{item.note}</p>}
              </div>
              <p className="text-cream/70 text-sm shrink-0">
                ฿{(Number(item.unitPrice) * item.quantity).toLocaleString("en-US")}
              </p>
            </div>
            {canEditItems ? (
              <div className="flex items-center justify-between mt-3">
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => (item.quantity > 1 ? handleQuantityChange(item, item.quantity - 1) : handleRemoveItem(item.id))}
                    disabled={busyItemId === item.id}
                    className="w-11 h-11 rounded-full bg-ink text-cream text-lg font-medium active:bg-cream/10 transition-colors disabled:opacity-50"
                  >
                    −
                  </button>
                  <span className="w-10 text-center text-cream">{item.quantity}</span>
                  <button
                    type="button"
                    onClick={() => handleQuantityChange(item, item.quantity + 1)}
                    disabled={busyItemId === item.id}
                    className="w-11 h-11 rounded-full bg-ink text-cream text-lg font-medium active:bg-cream/10 transition-colors disabled:opacity-50"
                  >
                    +
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => handleRemoveItem(item.id)}
                  disabled={busyItemId === item.id}
                  className="text-sm text-cream/50 active:text-coral transition-colors px-2 py-2"
                >
                  Remove
                </button>
              </div>
            ) : (
              <p className="text-xs text-cream/40 mt-2">{item.quantity}×</p>
            )}
          </div>
        ))}
        {order.items.length === 0 && <p className="text-cream/50 text-sm">No items yet.</p>}
      </div>

      {canAddItems && (
        <div>
          <p className="eyebrow text-cream/50 mb-3">Add items</p>
          <PosMenuPicker orderId={order.id} menu={menu} onAdded={setOrder} />
        </div>
      )}

      {canEditItems && (
        <button
          type="button"
          onClick={handleSend}
          disabled={sending || order.items.length === 0}
          className="w-full rounded-xl bg-coral active:bg-coraldeep transition-colors py-3.5 text-base font-medium disabled:opacity-60"
        >
          {sending ? "Sending…" : "Send to kitchen"}
        </button>
      )}

      {closable && (
        <div>
          <button
            type="button"
            onClick={handlePrintPrebill}
            disabled={printingPrebill}
            className="w-full rounded-xl border border-cream/25 active:border-cream/50 transition-colors py-3 text-sm font-medium disabled:opacity-60"
          >
            {printingPrebill ? "Printing…" : "Print pre-bill"}
          </button>
          {prebillError && <p className="mt-2 text-sm text-coral">{prebillError}</p>}
          {prebillResult && (
            <p className={`mt-2 text-sm ${prebillResult.job?.status === "SENT" ? "text-cream/50" : "text-coral"}`}>
              {!prebillResult.attempted
                ? "No active cashier printer configured."
                : prebillResult.job?.status === "SENT"
                  ? "Pre-bill printed."
                  : "Print failed — it's in the print queue for retry."}
            </p>
          )}
        </div>
      )}

      {closable && canManagePayments && (
        <div className="space-y-2 pt-2 border-t border-cream/10">
          <p className="eyebrow text-cream/50">Payment</p>
          {hasOpenShift === false ? (
            <p className="text-sm text-cream/60">
              Open a shift to accept payment.{" "}
              <Link href="/pos/shifts" className="text-sea active:text-coral transition-colors underline underline-offset-4">
                Open shift →
              </Link>
            </p>
          ) : confirmingMethod ? (
            <PosAttributedConfirm
              title={`Close order — ${PAYMENT_METHOD_LABELS[confirmingMethod]}`}
              detail={`฿${Number(order.total).toLocaleString("en-US")}`}
              actorEmail={actorEmail}
              actorRole={ROLE_LABELS[actorRole]}
              confirmLabel="Confirm payment"
              busy={closingMethod !== null}
              error={error}
              onConfirm={() => handleClose(confirmingMethod)}
              onCancel={() => {
                setConfirmingMethod(null);
                setError(null);
              }}
            />
          ) : !showRoomCharge ? (
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setConfirmingMethod("CASH")}
                disabled={hasOpenShift !== true}
                className="rounded-xl border border-cream/25 active:border-cream/50 transition-colors py-3.5 text-sm font-medium disabled:opacity-60"
              >
                Cash
              </button>
              <button
                type="button"
                onClick={() => setConfirmingMethod("CARD")}
                disabled={hasOpenShift !== true}
                className="rounded-xl border border-cream/25 active:border-cream/50 transition-colors py-3.5 text-sm font-medium disabled:opacity-60"
              >
                Card
              </button>
              <button
                type="button"
                onClick={() => setShowRoomCharge(true)}
                disabled={hasOpenShift !== true}
                className="rounded-xl border border-cream/25 active:border-cream/50 transition-colors py-3.5 text-sm font-medium disabled:opacity-60"
              >
                Room
              </button>
            </div>
          ) : (
            <PosRoomChargeSearch
              orderId={order.id}
              actorEmail={actorEmail}
              actorRole={ROLE_LABELS[actorRole]}
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
        <button type="button" onClick={handleCancel} className="w-full text-sm text-cream/50 active:text-coral transition-colors py-2">
          Cancel order
        </button>
      )}
    </div>
  );
}
