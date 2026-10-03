"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { usePolling } from "@/lib/usePolling";
import { fetchBoardData } from "@/lib/adminOrdersClient";
import { draftOrderHref } from "@/lib/posDraftOrder";
import {
  STATUS_LABELS,
  STATUS_STYLES,
  ZONE_LABELS,
  isLongOpen,
  isSpaOrder,
  longOpenLabel,
  orderNumberLabel,
  ticketTitle,
} from "@/lib/posOrders";
import type { Order, Table, Zone } from "@/lib/posTypes";

// SPA is deliberately excluded - spa tables live on their own screen now (/admin/spa/tables),
// and this board's own poll (fetchBoardData, below) refetches every table unfiltered, so
// excluding SPA here (not just from the initialTables prop) is what keeps a spa table from
// reappearing on the next 5-second poll.
const ZONES: Zone[] = ["RESTAURANT", "BAR", "POOL", "ROOM_SERVICE"];

// An order still open a day after it was opened is flagged (amber - "attention, not urgent"): it is
// almost always a forgotten table or a ticket nobody closed. lib/posOrders.ts#isLongOpen.

export default function OrderBoard({
  initialTables,
  initialOrders,
}: {
  initialTables: Table[];
  initialOrders: Order[];
}) {
  const router = useRouter();
  const [tables, setTables] = useState(initialTables);
  const [orders, setOrders] = useState(initialOrders);
  const [tab, setTab] = useState<"tables" | "tickets">("tables");
  const [creatingTableId, setCreatingTableId] = useState<string | null>(null);
  const [creatingTicket, setCreatingTicket] = useState(false);
  const [newTicketName, setNewTicketName] = useState("");
  // A table with >1 open order (the backend doesn't enforce one-order-per-
  // table — POST /orders accepts any tableId) shows a picker here instead
  // of silently jumping to whichever order happened to be first.
  const [pickerTableId, setPickerTableId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // useState(initialTables) only takes its initial value on mount — a
  // sibling mutating tables (TableManager) and calling router.refresh()
  // re-renders this component with a new `initialTables` prop, but without
  // this effect the board's own state would silently keep showing the old
  // array until the next poll. Orders aren't affected by that sibling, so
  // only tables need this resync.
  useEffect(() => {
    setTables(initialTables);
  }, [initialTables]);

  async function refetch() {
    const result = await fetchBoardData();
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setError(null);
    setTables(result.tables);
    setOrders(result.orders);
  }

  usePolling(refetch, 5000);

  // Map<tableId, Order[]>, not Map<tableId, Order> — a single "latest wins"
  // slot would silently drop a second open order on the same table out of
  // the interface entirely, the same class of bug as the inactive-table
  // case below.
  const ordersByTableId = new Map<string, Order[]>();
  for (const o of orders) {
    if (!o.tableId) continue;
    const list = ordersByTableId.get(o.tableId);
    if (list) list.push(o);
    else ordersByTableId.set(o.tableId, [o]);
  }
  const openTickets = orders.filter((o) => !o.tableId);
  const now = new Date();
  // Rule: the board must never let an OPEN/SENT order disappear just because
  // its table was deactivated after the order was opened. So a table is
  // shown when it's active, OR when it's inactive but still has one of the
  // orders above sitting on it (rendered dimmed/"Inactive" below, and not
  // clickable to start a new order).
  const visibleTables = tables.filter((t) => t.isActive || ordersByTableId.has(t.id));

  async function handleTableClick(table: Table) {
    const existing = ordersByTableId.get(table.id) ?? [];
    if (existing.length > 1) {
      setPickerTableId(table.id);
      return;
    }
    if (existing.length === 1) {
      router.push(`/admin/pos/orders/${existing[0].id}`);
      return;
    }
    // No order is created here: the ticket opens as a draft and the order comes into existence
    // with its first item (lib/posDraftOrder.ts), so opening a free table and backing out leaves
    // the table free and nothing in the order history.
    setError(null);
    setCreatingTableId(table.id);
    router.push(draftOrderHref("/admin/pos/orders", { tableId: table.id }));
  }

  async function handleNewTicket(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setCreatingTicket(true);
    router.push(draftOrderHref("/admin/pos/orders", { guestName: newTicketName }));
  }

  return (
    <div>
      <div className="flex gap-2 mb-6">
        <button
          type="button"
          onClick={() => setTab("tables")}
          className={`text-sm px-4 py-2 rounded-full transition-colors ${
            tab === "tables" ? "bg-coral text-cream" : "text-cream/60 hover:text-cream"
          }`}
        >
          Tables
        </button>
        <button
          type="button"
          onClick={() => setTab("tickets")}
          className={`text-sm px-4 py-2 rounded-full transition-colors ${
            tab === "tickets" ? "bg-coral text-cream" : "text-cream/60 hover:text-cream"
          }`}
        >
          Open tickets {openTickets.length > 0 && `(${openTickets.length})`}
        </button>
      </div>

      {error && <p className="text-sm text-coral mb-4">{error}</p>}

      {tab === "tables" ? (
        <div className="space-y-8">
          {ZONES.map((zone) => {
            const zoneTables = visibleTables.filter((t) => t.zone === zone);
            if (zoneTables.length === 0) return null;
            return (
              <div key={zone}>
                <p className="eyebrow text-cream/50 mb-3">{ZONE_LABELS[zone]}</p>
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
                  {zoneTables.map((table) => {
                    const tableOrders = ordersByTableId.get(table.id) ?? [];
                    const busy = creatingTableId === table.id;
                    const stale = tableOrders.find((o) => isLongOpen(o, now));
                    return (
                      <button
                        key={table.id}
                        type="button"
                        disabled={busy}
                        onClick={() => handleTableClick(table)}
                        className={`aspect-square rounded-xl text-sm flex flex-col items-center justify-center gap-1 transition-colors ${
                          tableOrders.length > 0 ? "bg-coral/20 text-coral" : "bg-sea/10 text-cream/70 hover:bg-sea/20"
                        } ${!table.isActive ? "border border-dashed border-cream/30" : ""} ${
                          stale ? "ring-2 ring-amber-400" : ""
                        } ${busy ? "opacity-50" : ""}`}
                      >
                        <span className="font-display text-lg">{table.label}</span>
                        {tableOrders.length === 1 && (
                          <span
                            className={`text-[0.6rem] rounded-full px-2 py-0.5 ${STATUS_STYLES[tableOrders[0].status]}`}
                          >
                            {tableOrders[0].status}
                          </span>
                        )}
                        {tableOrders.length > 1 && (
                          <span className="text-[0.6rem] rounded-full px-2 py-0.5 bg-coral/30 text-coral">
                            {tableOrders.length} open
                          </span>
                        )}
                        {/* Inactive tables are only ever rendered here because
                            they still have an open order (see visibleTables) —
                            flagged so staff know it's deactivated, not a
                            normal open table. */}
                        {!table.isActive && <span className="text-[0.6rem] text-cream/40">Inactive</span>}
                        {stale && (
                          <span className="text-[0.6rem] text-amber-400" suppressHydrationWarning>
                            {longOpenLabel(stale.createdAt, now)}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {pickerTableId &&
            (() => {
              const table = tables.find((t) => t.id === pickerTableId);
              const tableOrders = ordersByTableId.get(pickerTableId) ?? [];
              if (!table || tableOrders.length === 0) return null;
              return (
                <div className="bg-ink2/40 border border-cream/10 rounded-xl p-4">
                  <p className="text-sm text-cream/70 mb-3">
                    {table.label} has {tableOrders.length} open orders — pick one:
                  </p>
                  <div className="flex flex-wrap gap-2 mb-3">
                    {tableOrders.map((o) => (
                      <Link
                        key={o.id}
                        href={`/admin/pos/orders/${o.id}`}
                        className="text-sm rounded-full border border-cream/25 hover:border-cream/50 transition-colors px-3 py-1.5"
                      >
                        {orderNumberLabel(o)} · {STATUS_LABELS[o.status]}
                        {isLongOpen(o, now) && <span className="text-amber-400"> · {longOpenLabel(o.createdAt, now)}</span>}
                      </Link>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={() => setPickerTableId(null)}
                    className="text-xs text-cream/40 hover:text-cream/70 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              );
            })()}
          {visibleTables.length === 0 && (
            <p className="text-cream/50 text-sm">
              No tables set up yet —{" "}
              <a href="#table-manager" className="text-sea hover:text-coral transition-colors underline underline-offset-4">
                add one below
              </a>
              .
            </p>
          )}
        </div>
      ) : (
        <div>
          <form onSubmit={handleNewTicket} className="flex gap-3 mb-6 max-w-md">
            <input
              type="text"
              value={newTicketName}
              onChange={(e) => setNewTicketName(e.target.value)}
              placeholder="Guest name (optional)"
              className="flex-1 bg-transparent border-b border-cream/25 py-2 text-cream text-sm placeholder:text-cream/30 focus:outline-none focus:border-coral"
            />
            <button
              type="submit"
              disabled={creatingTicket}
              className="rounded-full bg-coral hover:bg-coraldeep transition-colors px-5 py-2.5 text-sm font-medium disabled:opacity-60"
            >
              {creatingTicket ? "Creating…" : "New ticket"}
            </button>
          </form>

          <div className="space-y-2">
            {openTickets.map((order) => (
              <Link
                key={order.id}
                href={`/admin/pos/orders/${order.id}`}
                className={`flex items-center justify-between gap-3 bg-ink2/40 border rounded-xl p-4 hover:bg-cream/5 transition-colors ${
                  isLongOpen(order, now) ? "border-amber-400/60" : "border-cream/10"
                }`}
              >
                <span className="text-cream min-w-0">
                  {ticketTitle(order)} <span className="text-cream/40 text-sm">{orderNumberLabel(order)}</span>
                  {isLongOpen(order, now) && (
                    <span className="block text-xs text-amber-400" suppressHydrationWarning>
                      {longOpenLabel(order.createdAt, now)} — forgotten?
                    </span>
                  )}
                </span>
                <span className="flex items-center gap-2 shrink-0">
                  {isSpaOrder(order, null) && (
                    <span className="text-xs rounded-full px-2.5 py-1 border border-cream/25 text-cream/70">✿ Spa</span>
                  )}
                  <span className={`text-xs rounded-full px-2.5 py-1 ${STATUS_STYLES[order.status]}`}>{STATUS_LABELS[order.status]}</span>
                </span>
              </Link>
            ))}
            {openTickets.length === 0 && <p className="text-cream/50 text-sm">No open tickets.</p>}
          </div>
        </div>
      )}
    </div>
  );
}
