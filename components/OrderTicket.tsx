"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { usePolling } from "@/lib/usePolling";
import { cashTender } from "@/lib/cashTender";
import { menuForOrder } from "@/lib/posMenu";
import type { DraftOrderTarget } from "@/lib/posDraftOrder";
import {
  PAYMENT_METHOD_LABELS,
  STATUS_LABELS,
  STATUS_STYLES,
  VOID_REASON_MAX,
  isTerminalStatus,
  orderNumberLabel,
  orderRefLabel,
  validateVoidReason,
} from "@/lib/posOrders";
import {
  fetchOrder,
  updateOrderItemQuantity,
  removeOrderItem,
  sendOrder,
  cancelOrder,
  closeOrder,
  printPrebill,
  printReceipt,
  voidOrderItem,
} from "@/lib/pos/ordersClient";
import { sendButtonLabel } from "@/lib/posSendLabel";
import { fetchCurrentShift } from "@/lib/pos/shiftsClient";
import CashTenderFields from "@/components/CashTenderFields";
import GuestOrderQrButton from "@/components/GuestOrderQrButton";
import OrderMenuPicker from "@/components/OrderMenuPicker";
import RoomChargeSearch from "@/components/RoomChargeSearch";
import PosAttributedConfirm from "@/components/pos/PosAttributedConfirm";
import type { Role } from "@/lib/session";
import { formatTimestamp } from "@/lib/formatDate";
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
//   - `back`: where "back" goes once the order is paid or cancelled - the floor board the ticket
//     came from, or the spa schedule for a spa ticket (lib/posOrderBack.ts).
// Screen width decides only the arrangement: one column on a phone (lines, menu, actions), and
// from `xl` up the menu on the left with the ticket and its actions in a column on the right.
type Surface = {
  basePath: "/admin/pos" | "/pos";
  actor: { email: string; role: Role } | null;
  back: { href: string; label: string };
};

type TicketProps = Surface & {
  menu: MenuItem[];
  // The zone of the order's table, or null for a table-less ticket - decides which menu items can
  // be rung up at all (lib/posMenu.ts#menuForOrder).
  tableZone: Zone | null;
  // Computed by the page from the session role (CASHIER+), not just used to hide the payment
  // section here - a WAITER must never see a payment button that only fails once clicked.
  canManagePayments: boolean;
  // MANAGER+ (POST .../items/{itemId}/void): taking a line off a ticket the kitchen already has is
  // how a shortfall would be hidden, so it isn't the waiter's or the cashier's call. Below that
  // role the Void button isn't rendered at all.
  canVoidSentItems: boolean;
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
  bar,
}: {
  withMenu: boolean;
  ticket: React.ReactNode;
  menu?: React.ReactNode;
  actions?: React.ReactNode;
  // Below xl only: pinned to the bottom of the screen so the total and Send stay in reach while
  // scrolling a long menu on a phone. From xl the actions column is already beside the menu.
  bar?: React.ReactNode;
}) {
  const pinned = bar ? (
    <div className="xl:hidden sticky bottom-0 z-30 -mx-4 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] bg-ink/95 backdrop-blur border-t border-cream/10">
      {bar}
    </div>
  ) : null;
  if (!withMenu) {
    return (
      <div className="max-w-xl space-y-6">
        {ticket}
        {actions}
        {pinned}
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
      {pinned}
    </div>
  );
}

function LiveOrderTicket({
  initialOrder,
  menu,
  tableZone,
  canManagePayments,
  canVoidSentItems,
  basePath,
  actor,
  back,
}: TicketProps & { initialOrder: Order }) {
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
  const [reprinting, setReprinting] = useState(false);
  const [reprintResult, setReprintResult] = useState<PrintAttemptResult | null>(null);
  const [reprintError, setReprintError] = useState<string | null>(null);
  // The line whose void is being confirmed (one at a time), with its form state.
  const [voiding, setVoiding] = useState<{ itemId: string; quantity: number; reason: string; reasonError: string | null } | null>(null);
  const [voidBusy, setVoidBusy] = useState(false);
  const [voidError, setVoidError] = useState<string | null>(null);
  const [confirmingCancel, setConfirmingCancel] = useState(false);
  const [cancelBusy, setCancelBusy] = useState(false);

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
    setCancelBusy(true);
    setError(null);
    const result = await cancelOrder(order.id);
    setCancelBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setConfirmingCancel(false);
    setOrder(result.data);
  }

  async function handleVoid() {
    if (!voiding) return;
    const reasonError = validateVoidReason(voiding.reason);
    if (reasonError) {
      setVoiding({ ...voiding, reasonError });
      return;
    }
    setVoidBusy(true);
    setVoidError(null);
    const result = await voidOrderItem(order.id, voiding.itemId, { quantity: voiding.quantity, reason: voiding.reason.trim() });
    setVoidBusy(false);
    if (!result.ok) {
      setVoidError(result.error);
      return;
    }
    setVoiding(null);
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

  async function handleReprintReceipt() {
    setReprinting(true);
    setReprintResult(null);
    setReprintError(null);
    const result = await printReceipt(order.id);
    setReprinting(false);
    if (!result.ok) {
      setReprintError(result.error);
      return;
    }
    setReprintResult(result.data);
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
  const send = sendButtonLabel(
    order.items.filter((i) => i.sentAt === null).map((i) => menuById.get(i.menuItemId)?.department ?? "KITCHEN"),
  );
  // Rendered for as long as the order is open, disabled once sent - never removed. When it
  // disappeared after sending, the next button slid up into exactly the spot just clicked, so a
  // double-click on Send closed the order.
  const sendButton = (
    <button
      type="button"
      onClick={handleSend}
      disabled={!canEditItems || sending || order.items.length === 0}
      className="w-full rounded-xl bg-coral hover:bg-coraldeep active:bg-coraldeep transition-colors py-3.5 text-base font-medium disabled:opacity-60"
    >
      {sending ? "Sending…" : canEditItems ? send.label : "Sent ✓"}
    </button>
  );

  const ticket = (
    <>
      <div className="flex items-center gap-3 flex-wrap">
        <span className={`text-sm rounded-full px-3 py-1.5 ${STATUS_STYLES[order.status]}`}>{STATUS_LABELS[order.status]}</span>
        <span className="text-sm text-cream/70">
          Order {orderNumberLabel(order)} <span className="text-xs text-cream/40 font-mono">ref {orderRefLabel(order)}</span>
        </span>
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
          {canVoidSentItems ? " A manager can void a sent item with a reason." : " Ask a manager to void a sent item."}
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
      {error && !confirmingMethod && !confirmingCancel && <p className="text-sm text-coral">{error}</p>}

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
              <div className="flex items-center justify-between mt-2">
                <p className="text-xs text-cream/40">{item.quantity}×</p>
                {canVoidSentItems && closable && item.sentAt && voiding?.itemId !== item.id && (
                  <button
                    type="button"
                    onClick={() => {
                      setVoidError(null);
                      setVoiding({ itemId: item.id, quantity: item.quantity, reason: "", reasonError: null });
                    }}
                    className="text-sm text-cream/50 hover:text-coral active:text-coral transition-colors px-2 py-2"
                  >
                    Void
                  </button>
                )}
              </div>
            )}
            {voiding?.itemId === item.id && (
              <div className="mt-3">
                <PosAttributedConfirm
                  title={`Void — ${menuById.get(item.menuItemId)?.name ?? "item"}`}
                  detail={`${voiding.quantity} × ฿${Number(item.unitPrice).toLocaleString("en-US")}`}
                  actorEmail={actorLabel?.email}
                  actorRole={actorLabel?.role}
                  confirmLabel="Void item"
                  cancelLabel="Keep item"
                  busy={voidBusy}
                  error={voidError}
                  onConfirm={handleVoid}
                  onCancel={() => {
                    setVoiding(null);
                    setVoidError(null);
                  }}
                >
                  <p className="text-sm text-cream/60">
                    Already sent to the kitchen/bar — a void ticket is printed there, and the item comes off the bill.
                  </p>
                  {item.quantity > 1 && (
                    <div className="flex items-center gap-2">
                      <span className="eyebrow text-cream/60 mr-1">How many</span>
                      <button
                        type="button"
                        aria-label="Void one fewer"
                        onClick={() => setVoiding({ ...voiding, quantity: Math.max(1, voiding.quantity - 1) })}
                        disabled={voidBusy || voiding.quantity <= 1}
                        className="w-11 h-11 rounded-full bg-ink text-cream text-lg font-medium hover:bg-cream/10 active:bg-cream/10 transition-colors disabled:opacity-50"
                      >
                        −
                      </button>
                      <span className="w-10 text-center text-cream">
                        {voiding.quantity} of {item.quantity}
                      </span>
                      <button
                        type="button"
                        aria-label="Void one more"
                        onClick={() => setVoiding({ ...voiding, quantity: Math.min(item.quantity, voiding.quantity + 1) })}
                        disabled={voidBusy || voiding.quantity >= item.quantity}
                        className="w-11 h-11 rounded-full bg-ink text-cream text-lg font-medium hover:bg-cream/10 active:bg-cream/10 transition-colors disabled:opacity-50"
                      >
                        +
                      </button>
                    </div>
                  )}
                  <div>
                    <label className="eyebrow text-cream/60 block mb-1">
                      Reason <span className="text-coral">*</span>
                    </label>
                    <textarea
                      rows={2}
                      value={voiding.reason}
                      maxLength={VOID_REASON_MAX}
                      autoFocus
                      onChange={(e) => setVoiding({ ...voiding, reason: e.target.value, reasonError: null })}
                      placeholder="e.g. guest sent it back, rung up by mistake"
                      className={`w-full bg-ink border rounded-xl px-3 py-2 text-sm text-cream placeholder:text-cream/30 focus:outline-none focus:border-coral ${
                        voiding.reasonError ? "border-coral" : "border-cream/20"
                      }`}
                    />
                    {voiding.reasonError && <p className="text-xs text-coral mt-1">{voiding.reasonError}</p>}
                  </div>
                </PosAttributedConfirm>
              </div>
            )}
          </div>
        ))}
        {order.items.length === 0 && <p className="text-cream/50 text-sm">No items yet.</p>}
      </div>

      {order.voids.length > 0 && (
        <div className="space-y-2">
          <p className="eyebrow text-cream/50">Voided after sending</p>
          {order.voids.map((v) => (
            <div key={v.id} className="border border-dashed border-cream/15 rounded-2xl px-4 py-3">
              <div className="flex items-start justify-between gap-3">
                <p className="text-cream/50 line-through">{menuById.get(v.menuItemId)?.name ?? "Unknown item"}</p>
                <p className="text-cream/40 text-sm shrink-0 line-through">
                  {v.quantity} × ฿{Number(v.unitPrice).toLocaleString("en-US")}
                </p>
              </div>
              <p className="text-xs text-cream/50 mt-1">&ldquo;{v.reason}&rdquo;</p>
              <p className="text-xs text-cream/40">
                {v.voidedByEmail} · {formatTimestamp(v.voidedAt)}
              </p>
            </div>
          ))}
        </div>
      )}
    </>
  );

  const actions = closable ? (
    <>
      {/* Below xl this button lives in the pinned bar instead (see `bar` below) - one Send, never two. */}
      <div className="hidden xl:block space-y-2">
        {sendButton}
        {canEditItems && send.note && <p className="text-xs text-cream/40">{send.note}</p>}
      </div>

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

      {confirmingCancel ? (
        <PosAttributedConfirm
          title="Cancel order"
          detail={`Order ${orderNumberLabel(order)}`}
          actorEmail={actorLabel?.email}
          actorRole={actorLabel?.role}
          confirmLabel="Cancel order"
          cancelLabel="Keep order"
          busy={cancelBusy}
          error={error}
          onConfirm={handleCancel}
          onCancel={() => {
            setConfirmingCancel(false);
            setError(null);
          }}
        >
          <p className="text-sm text-cream/60">Nothing is charged and the table is freed. This can&rsquo;t be undone.</p>
        </PosAttributedConfirm>
      ) : (
        <button
          type="button"
          onClick={() => {
            setError(null);
            setConfirmingCancel(true);
          }}
          className="w-full text-sm text-cream/50 hover:text-coral active:text-coral transition-colors py-2"
        >
          Cancel order
        </button>
      )}
    </>
  ) : (
    // Paid or cancelled: nothing left to do to the order itself, but the screen must not end in a
    // dead end - a way back to the floor, and (paid, cashier+) a copy of the receipt.
    <>
      {order.status === "PAID" && canManagePayments && (
        <div>
          <button
            type="button"
            onClick={handleReprintReceipt}
            disabled={reprinting}
            className="w-full rounded-xl border border-cream/25 hover:border-cream/50 active:border-cream/50 transition-colors py-3 text-sm font-medium disabled:opacity-60"
          >
            {reprinting ? "Printing…" : "Reprint receipt"}
          </button>
          {reprintError && <p className="mt-2 text-sm text-coral">{reprintError}</p>}
          {reprintResult && (
            <p className={`mt-2 text-sm ${reprintResult.job?.status === "SENT" ? "text-cream/50" : "text-coral"}`}>
              {!reprintResult.attempted
                ? "No active cashier printer configured — nothing printed."
                : reprintResult.job?.status === "SENT"
                  ? "Receipt copy printed."
                  : reprintResult.job?.status === "PENDING"
                    ? "Printer didn't respond — retrying automatically."
                    : // Receipts are hidden from a cashier's print queue (GET /print-jobs), so point at who can see it.
                      `Print failed${reprintResult.job?.lastError ? `: ${reprintResult.job.lastError}` : ""} — a manager can retry it from the print queue.`}
            </p>
          )}
        </div>
      )}
      <Link
        href={back.href}
        className="block w-full text-center rounded-xl bg-coral hover:bg-coraldeep active:bg-coraldeep transition-colors py-3.5 text-base font-medium"
      >
        {back.label}
      </Link>
    </>
  );

  return (
    <TicketLayout
      withMenu={canAddItems}
      ticket={ticket}
      menu={<OrderMenuPicker orderId={order.id} menu={menuForOrder(menu, tableZone)} onAdded={setOrder} />}
      actions={actions}
      bar={
        closable ? (
          <div className="flex items-center gap-3">
            <div className="shrink-0">
              <p className="eyebrow text-cream/50">Total</p>
              <p className="font-display italic text-2xl text-coral leading-tight">฿{Number(order.total).toLocaleString("en-US")}</p>
            </div>
            <div className="flex-1 min-w-0">
              {sendButton}
              {canEditItems && send.note && <p className="mt-1 text-xs text-cream/40 text-center">{send.note}</p>}
            </div>
          </div>
        ) : null
      }
    />
  );
}
