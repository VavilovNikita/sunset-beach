"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { usePolling } from "@/lib/usePolling";
import { cashTender } from "@/lib/cashTender";
import { menuForOrder } from "@/lib/posMenu";
import type { DraftOrderTarget } from "@/lib/posDraftOrder";
import { PAYMENT_METHOD_LABELS, STATUS_LABELS, STATUS_STYLES, isTerminalStatus } from "@/lib/posOrders";
import { fetchOrder, updateOrderItemQuantity, removeOrderItem, sendOrder, cancelOrder, closeOrder, printPrebill } from "@/lib/pos/ordersClient";
import { fetchCurrentShift } from "@/lib/pos/shiftsClient";
import CashTenderFields from "@/components/CashTenderFields";
import GuestOrderQrButton from "@/components/GuestOrderQrButton";
import OrderMenuPicker from "@/components/OrderMenuPicker";
import RoomChargeSearch from "@/components/RoomChargeSearch";
import PosAttributedConfirm from "@/components/pos/PosAttributedConfirm";
import type { Role } from "@/lib/session";
import type { Order, MenuItem, PaymentMethod, PrintAttemptResult, Zone } from "@/lib/posTypes";

const ROLE_LABELS: Record<Role, string> = { WAITER: "Waiter", CASHIER: "Cashier", MANAGER: "Manager", ADMIN: "Admin" };

// The one order ticket both POS surfaces render - the desktop till (/admin/pos/orders/...) and the
// phone (/pos/orders/...). They used to be two separate components that had drifted apart (the
// desktop had a <select> with no search and no +/-), and every fix had to be made twice. What
// still differs between the surfaces is passed in, not branched on by screen size:
//   - `basePath`: which section's URLs this ticket links to (its own URL once created, the shift
//     screen).
//   - `actor`: the phone's "will be recorded as" identity check before money moves (see
//     PosAttributedConfirm.tsx for why only the phone has it). null on the till - there Card and
//     Charge to room close directly, and Cash only asks for the amount received.
// Screen width decides only the arrangement: one column on a phone (lines, menu, actions), and
// from `xl` up the menu on the left with the ticket and its actions in a column on the right.
type Surface = {
  basePath: "/admin/pos" | "/pos";
  actor: { email: string; role: Role } | null;
};

type TicketProps = Surface & {
  menu: MenuItem[];
  // The zone of the order's table, or null for a table-less ticket - decides which menu items can
  // be rung up at all (lib/posMenu.ts#menuForOrder).
  tableZone: Zone | null;
  // Computed by the page from the session role (CASHIER+), not just used to hide the payment
  // section here - a WAITER must never see a payment button that only fails once clicked.
  canManagePayments: boolean;
};

// `initialOrder: null` is a draft (lib/posDraftOrder.ts): nothing exists in the database yet, the
// table stays free, and the first tap on a menu item creates the order with that line in one
// request. Leaving the screen before that leaves nothing behind.
export default function OrderTicket({
  initialOrder,
  draft,
  ...props
}: TicketProps & { initialOrder: Order | null; draft?: DraftOrderTarget }) {
  const router = useRouter();
  const [created, setCreated] = useState<Order | null>(initialOrder);
  if (!created) {
    return (
      <TicketLayout
        withMenu
        ticket={<p className="text-cream/50 text-sm">No items yet — the order starts when you add the first one.</p>}
        menu={
          <OrderMenuPicker
            orderId={null}
            draft={draft}
            menu={menuForOrder(props.menu, props.tableZone)}
            onAdded={(order) => {
              setCreated(order);
              router.replace(`${props.basePath}/orders/${order.id}`);
            }}
          />
        }
      />
    );
  }
  return <LiveOrderTicket initialOrder={created} {...props} />;
}

// Three blocks so the phone keeps its top-to-bottom order (lines, then the menu, then Send and
// payment) while a wide screen puts the menu in its own column beside the other two.
function TicketLayout({
  withMenu,
  ticket,
  menu,
  actions,
}: {
  withMenu: boolean;
  ticket: React.ReactNode;
  menu?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  if (!withMenu) {
    return (
      <div className="max-w-xl space-y-6">
        {ticket}
        {actions}
      </div>
    );
  }
  return (
    <div className="space-y-6 xl:space-y-0 xl:grid xl:grid-cols-[minmax(0,1fr)_380px] xl:gap-x-8 xl:gap-y-6 xl:items-start">
      <section className="space-y-6 xl:col-start-2 xl:row-start-1">{ticket}</section>
      <section className="xl:col-start-1 xl:row-start-1 xl:row-span-2">
        <p className="eyebrow text-cream/50 mb-3">Add items</p>
        {menu}
      </section>
      {actions && <section className="space-y-6 xl:col-start-2 xl:row-start-2">{actions}</section>}
    </div>
  );
}

function LiveOrderTicket({ initialOrder, menu, tableZone, canManagePayments, basePath, actor }: TicketProps & { initialOrder: Order }) {
  const [order, setOrder] = useState(initialOrder);
  const [cashReceived, setCashReceived] = useState("");
  const [busyItemId, setBusyItemId] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [confirmingMethod, setConfirmingMethod] = useState<"CASH" | "CARD" | null>(null);
  const [closingMethod, setClosingMethod] = useState<PaymentMethod | null>(null);
  const [showRoomCharge, setShowRoomCharge] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // POST /orders/{id}/close requires the calling user to have an open shift (Payment.shiftId is
  // NOT NULL) - checked once on mount (a fresh mount also happens naturally after navigating back
  // from the shifts screen, so there's no need to re-check on an interval).
  const [hasOpenShift, setHasOpenShift] = useState<boolean | null>(null);
  // POST .../close returns the Order (status=PAID), not the Payment it created - there's no
  // endpoint to fetch that Payment back. The amount is read from the response's order.total (the
  // server always charges the full total), the method is whatever this component just sent.
  const [lastPayment, setLastPayment] = useState<{ method: PaymentMethod; amount: number } | null>(null);
  const [printingPrebill, setPrintingPrebill] = useState(false);
  const [prebillResult, setPrebillResult] = useState<PrintAttemptResult | null>(null);
  const [prebillError, setPrebillError] = useState<string | null>(null);

  // OrderItem only carries menuItemId (no denormalized name), so names are joined from the menu.
  const menuById = useMemo(() => new Map(menu.map((m) => [m.id, m])), [menu]);
  const actorLabel = actor ? { email: actor.email, role: ROLE_LABELS[actor.role] } : null;

  useEffect(() => {
    if (!canManagePayments) return; // nothing that reads hasOpenShift renders without this
    fetchCurrentShift().then((result) => setHasOpenShift(result.ok && result.data !== null));
  }, [canManagePayments]);

  async function refetch() {
    const result = await fetchOrder(order.id);
    if (result.ok) setOrder(result.data);
  }

  // Stops once the order reaches a terminal status, so a ticket left open in a background tab
  // doesn't keep polling forever.
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
    // A failed request here means no PrintJob was even queued (unlike a reachable-but-broken
    // printer, which still returns 201 with attempted:true/status:FAILED - see prebillResult).
    const result = await printPrebill(order.id);
    setPrintingPrebill(false);
    if (!result.ok) {
      setPrebillError(result.error);
      return;
    }
    setPrebillResult(result.data);
  }

  async function handleClose(method: "CASH" | "CARD") {
    if (method === "CASH" && !cash.ok) return;
    setClosingMethod(method);
    setError(null);
    const result = await closeOrder(order.id, method === "CASH" && cash.ok ? { method, amountTendered: cash.tendered } : { method });
    setClosingMethod(null);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setConfirmingMethod(null);
    setCashReceived("");
    setOrder(result.data);
    setLastPayment({ method, amount: Number(result.data.total) });
  }

  const cash = cashTender(order.total, cashReceived);
  // Adding items is allowed for OPEN and SENT (a dispatched order can still take a re-order);
  // editing/removing an existing line is OPEN-only - once sent, that line already went to the
  // kitchen/bar and can't be walked back.
  const canAddItems = order.status === "OPEN" || order.status === "SENT";
  const canEditItems = order.status === "OPEN";
  const closable = order.status === "OPEN" || order.status === "SENT";
  const payDisabled = closingMethod !== null || hasOpenShift !== true || order.items.length === 0;

  const ticket = (
    <>
      <div className="flex items-center gap-3 flex-wrap">
        <span className={`text-sm rounded-full px-3 py-1.5 ${STATUS_STYLES[order.status]}`}>{STATUS_LABELS[order.status]}</span>
        {order.bookingId && basePath === "/admin/pos" && (
          <Link href={`/admin/bookings/${order.bookingId}`} className="text-xs text-sea hover:text-coral transition-colors">
            Linked booking →
          </Link>
        )}
        <span className="font-display italic text-2xl text-coral ml-auto">฿{Number(order.total).toLocaleString("en-US")}</span>
      </div>

      {order.status === "SENT" && (
        <p className="text-sm text-cream/50 bg-ink2 border border-cream/10 rounded-xl px-4 py-3">
          Already sent — sent lines can&rsquo;t be edited or removed, but you can still add more.
        </p>
      )}

      {lastPayment ? (
        <p className="text-sm text-cream/50">
          Paid via {PAYMENT_METHOD_LABELS[lastPayment.method]} — ฿{lastPayment.amount.toLocaleString("en-US")}
        </p>
      ) : (
        // order.paymentMethod (unlike lastPayment) survives a reload - what makes a closed
        // order's payment method visible when reached from order history, not just right after
        // closing it in this same session.
        order.paymentMethod && <p className="text-sm text-cream/50">Paid via {PAYMENT_METHOD_LABELS[order.paymentMethod]}</p>
      )}

      {/* Suppressed while the payment confirm card is open - it surfaces `error` itself, right
          next to the retry button, instead of at the top of a ticket that may be scrolled past. */}
      {error && !confirmingMethod && <p className="text-sm text-coral">{error}</p>}

      <div className="space-y-2.5">
        {order.items.map((item) => (
          <div key={item.id} className="bg-ink2 border border-cream/10 rounded-2xl p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-cream">{menuById.get(item.menuItemId)?.name ?? "Unknown item"}</p>
                {item.note && <p className="text-xs text-cream/50 mt-0.5">{item.note}</p>}
              </div>
              <p className="text-cream/70 text-sm shrink-0">฿{(Number(item.unitPrice) * item.quantity).toLocaleString("en-US")}</p>
            </div>
            {canEditItems ? (
              <div className="flex items-center justify-between mt-3">
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    aria-label="One fewer"
                    onClick={() => (item.quantity > 1 ? handleQuantityChange(item, item.quantity - 1) : handleRemoveItem(item.id))}
                    disabled={busyItemId === item.id}
                    className="w-11 h-11 rounded-full bg-ink text-cream text-lg font-medium hover:bg-cream/10 active:bg-cream/10 transition-colors disabled:opacity-50"
                  >
                    −
                  </button>
                  <span className="w-10 text-center text-cream">{item.quantity}</span>
                  <button
                    type="button"
                    aria-label="One more"
                    onClick={() => handleQuantityChange(item, item.quantity + 1)}
                    disabled={busyItemId === item.id}
                    className="w-11 h-11 rounded-full bg-ink text-cream text-lg font-medium hover:bg-cream/10 active:bg-cream/10 transition-colors disabled:opacity-50"
                  >
                    +
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => handleRemoveItem(item.id)}
                  disabled={busyItemId === item.id}
                  className="text-sm text-cream/50 hover:text-coral active:text-coral transition-colors px-2 py-2"
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
    </>
  );

  const actions = closable ? (
    <>
      {/* Rendered for as long as the order is open, disabled once sent - never removed. When it
          disappeared after sending, the next button slid up into exactly the spot just clicked,
          so a double-click on Send closed the order. */}
      <button
        type="button"
        onClick={handleSend}
        disabled={!canEditItems || sending || order.items.length === 0}
        className="w-full rounded-xl bg-coral hover:bg-coraldeep active:bg-coraldeep transition-colors py-3.5 text-base font-medium disabled:opacity-60"
      >
        {sending ? "Sending…" : canEditItems ? "Send to kitchen" : "Sent ✓"}
      </button>

      <div>
        <button
          type="button"
          onClick={handlePrintPrebill}
          disabled={printingPrebill}
          className="w-full rounded-xl border border-cream/25 hover:border-cream/50 active:border-cream/50 transition-colors py-3 text-sm font-medium disabled:opacity-60"
        >
          {printingPrebill ? "Printing…" : "Print pre-bill"}
        </button>
        {/* The request routinely takes ~2s (PrinterClient's connect timeout, hit whenever the
            printer is unreachable) with nothing else on this screen changing meanwhile - without
            its own line here, a merely-disabled button reads exactly like a frozen page. */}
        {printingPrebill && <p className="mt-2 text-sm text-cream/40">Sending to printer…</p>}
        {prebillError && <p className="mt-2 text-sm text-coral">{prebillError}</p>}
        {prebillResult && (
          <p className={`mt-2 text-sm ${prebillResult.job?.status === "SENT" ? "text-cream/50" : "text-coral"}`}>
            {!prebillResult.attempted
              ? "No active cashier printer configured — nothing printed."
              : prebillResult.job?.status === "SENT"
                ? "Pre-bill printed."
                : prebillResult.job?.status === "PENDING"
                  ? "Printer didn't respond — retrying automatically."
                  : `Print failed${prebillResult.job?.lastError ? `: ${prebillResult.job.lastError}` : ""} — it's in the print queue for retry.`}
          </p>
        )}
      </div>

      {/* Dine-in only - a table is what the guest is sitting at when they'd scan this, and what
          OrderService#requireGuestAccess's ADDABLE_STATUSES gate is scoped to via `closable`.
          Hidden entirely (not just disabled) once guestAccessToken is null - see that
          component's own comment. */}
      {order.tableId && (
        <GuestOrderQrButton
          orderId={order.id}
          guestAccessToken={order.guestAccessToken}
          buttonClassName="w-full rounded-xl border border-cream/25 hover:border-cream/50 active:border-cream/50 transition-colors py-3 text-sm font-medium"
        />
      )}

      {canManagePayments && (
        <div className="space-y-2 pt-2 border-t border-cream/10">
          <p className="eyebrow text-cream/50">Payment</p>
          {hasOpenShift === false ? (
            <p className="text-sm text-cream/60">
              Open a shift to accept payment.{" "}
              <Link
                href={`${basePath}/shifts`}
                className="text-sea hover:text-coral active:text-coral transition-colors underline underline-offset-4"
              >
                Open shift →
              </Link>
            </p>
          ) : confirmingMethod ? (
            // The cash close always comes here (it needs the amount received); a card close only
            // on the phone, for the identity check - on the till Card closes straight away.
            <PosAttributedConfirm
              title={`Close order — ${PAYMENT_METHOD_LABELS[confirmingMethod]}`}
              detail={`฿${Number(order.total).toLocaleString("en-US")}`}
              actorEmail={actorLabel?.email}
              actorRole={actorLabel?.role}
              confirmLabel={actorLabel ? "Confirm payment" : "Close order"}
              busy={closingMethod !== null}
              error={error}
              confirmDisabled={confirmingMethod === "CASH" && !cash.ok}
              onConfirm={() => handleClose(confirmingMethod)}
              onCancel={() => {
                setConfirmingMethod(null);
                setCashReceived("");
                setError(null);
              }}
            >
              {confirmingMethod === "CASH" && (
                <CashTenderFields
                  total={order.total}
                  value={cashReceived}
                  onChange={setCashReceived}
                  inputClassName="w-full bg-ink border border-cream/20 rounded-xl px-4 py-3 text-cream text-lg focus:outline-none focus:border-coral"
                />
              )}
            </PosAttributedConfirm>
          ) : !showRoomCharge ? (
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => {
                  setError(null);
                  setConfirmingMethod("CASH");
                }}
                disabled={payDisabled}
                className="rounded-xl border border-cream/25 hover:border-cream/50 active:border-cream/50 transition-colors py-3.5 text-sm font-medium disabled:opacity-60"
              >
                Cash
              </button>
              <button
                type="button"
                onClick={() => (actor ? setConfirmingMethod("CARD") : handleClose("CARD"))}
                disabled={payDisabled}
                className="rounded-xl border border-cream/25 hover:border-cream/50 active:border-cream/50 transition-colors py-3.5 text-sm font-medium disabled:opacity-60"
              >
                {closingMethod === "CARD" ? "Closing…" : "Card"}
              </button>
              <button
                type="button"
                onClick={() => setShowRoomCharge(true)}
                disabled={payDisabled}
                className="rounded-xl border border-cream/25 hover:border-cream/50 active:border-cream/50 transition-colors py-3.5 text-sm font-medium disabled:opacity-60"
              >
                Room
              </button>
            </div>
          ) : (
            <RoomChargeSearch
              orderId={order.id}
              actor={actorLabel}
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

      <button
        type="button"
        onClick={handleCancel}
        className="w-full text-sm text-cream/50 hover:text-coral active:text-coral transition-colors py-2"
      >
        Cancel order
      </button>
    </>
  ) : null;

  return (
    <TicketLayout
      withMenu={canAddItems}
      ticket={ticket}
      menu={<OrderMenuPicker orderId={order.id} menu={menuForOrder(menu, tableZone)} onAdded={setOrder} />}
      actions={actions}
    />
  );
}
