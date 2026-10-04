"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { usePolling } from "@/lib/usePolling";
import { fetchBoardData } from "@/lib/pos/ordersClient";
import { draftOrderHref } from "@/lib/posDraftOrder";
import {
  STATUS_LABELS,
  STATUS_STYLES,
  ZONE_LABELS,
  isLongOpen,
  isSpaOrder,
  longOpenLabel,
  orderNumberLabel,
  ticketHeading,
  tableBillLabel,
} from "@/lib/posOrders";
import type { Order, Table, Zone } from "@/lib/posTypes";

// SPA is deliberately excluded - reception bills a treatment from the spa schedule's own billing
// door now (SpaAppointmentPanel, via lib/spaOrderClient.ts), not by tapping a spa table here or
// on the admin floor view (OrderBoard.tsx, excluded the same way). This board's own poll
// (fetchBoardData, below) refetches every table unfiltered, so excluding SPA here (not just from
// the initialTables prop) is what keeps a spa table from reappearing on the next poll.
const ZONES: Zone[] = ["RESTAURANT", "BAR", "POOL", "ROOM_SERVICE"];

// An order still open a day after it was opened is flagged (amber - "attention, not urgent"): it is
// almost always a forgotten table or a ticket nobody closed. lib/posOrders.ts#isLongOpen.

// Same grouping/occupancy rules as the admin OrderBoard (a table can have more than one open
// order, an inactive table with an order still open must stay visible) — that's about data
// integrity, not screen size, so it isn't relaxed here. Only the layout changes: two columns by
// default instead of up to six, larger cells, larger status text.
export default function PosTableBoard({
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
  const [pickerTableId, setPickerTableId] = useState<string | null>(null);
  const pickerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setTables(initialTables);
  }, [initialTables]);

  // Once per opening, not on every render - the 5s poll re-renders this board, and re-scrolling
  // each time would yank the page back to the picker while someone is looking elsewhere.
  useEffect(() => {
    if (pickerTableId) pickerRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [pickerTableId]);

  async function refetch() {
    const result = await fetchBoardData();
    if (result.ok) {
      setTables(result.data.tables);
      setOrders(result.data.orders);
    }
  }

  usePolling(refetch, 5000);

  const ordersByTableId = new Map<string, Order[]>();
  for (const o of orders) {
    if (!o.tableId) continue;
    const list = ordersByTableId.get(o.tableId);
    if (list) list.push(o);
    else ordersByTableId.set(o.tableId, [o]);
  }
  const openTickets = orders.filter((o) => !o.tableId);
  const now = new Date();
  const visibleTables = tables.filter((t) => t.isActive || ordersByTableId.has(t.id));

  async function handleTableClick(table: Table) {
    const existing = ordersByTableId.get(table.id) ?? [];
    if (existing.length > 1) {
      setPickerTableId(table.id);
      return;
    }
    if (existing.length === 1) {
      router.push(`/pos/orders/${existing[0].id}`);
      return;
    }
    // No order is created here - see the admin floor board (OrderBoard.tsx) and lib/posDraftOrder.ts.
    setError(null);
    setCreatingTableId(table.id);
    router.push(draftOrderHref("/pos/orders", { tableId: table.id }));
  }

  async function handleNewTicket(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setCreatingTicket(true);
    router.push(draftOrderHref("/pos/orders", { guestName: newTicketName }));
  }

  return (
    <div className="p-4">
      <div className="flex gap-2 mb-5">
        <button
          type="button"
          onClick={() => setTab("tables")}
          className={`flex-1 text-sm py-3 rounded-xl font-medium transition-colors ${
            tab === "tables" ? "bg-coral text-ink" : "bg-ink2 text-cream/60"
          }`}
        >
          Tables
        </button>
        <button
          type="button"
          onClick={() => setTab("tickets")}
          className={`flex-1 text-sm py-3 rounded-xl font-medium transition-colors ${
            tab === "tickets" ? "bg-coral text-ink" : "bg-ink2 text-cream/60"
          }`}
        >
          No table {openTickets.length > 0 && `(${openTickets.length})`}
        </button>
      </div>

      {error && <p className="text-sm text-coral mb-4">{error}</p>}

      {tab === "tables" ? (
        <div className="space-y-7">
          {ZONES.map((zone) => {
            const zoneTables = visibleTables.filter((t) => t.zone === zone);
            if (zoneTables.length === 0) return null;
            return (
              <div key={zone}>
                <p className="eyebrow text-cream/50 mb-3">{ZONE_LABELS[zone]}</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 grid-flow-dense">
                  {zoneTables.map((table) => {
                    const tableOrders = ordersByTableId.get(table.id) ?? [];
                    const busy = creatingTableId === table.id;
                    const stale = tableOrders.find((o) => isLongOpen(o, now));
                    return (
                      <Fragment key={table.id}>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => handleTableClick(table)}
                          className={`min-h-[76px] rounded-2xl text-base flex flex-col items-center justify-center gap-1.5 transition-colors ${
                            tableOrders.length > 0 ? "bg-coral/20 text-coral" : "bg-sea/10 text-cream/80 active:bg-sea/20"
                          } ${!table.isActive ? "border border-dashed border-cream/30" : ""} ${stale ? "ring-2 ring-amber-400" : ""} ${
                            busy ? "opacity-50" : ""
                          }`}
                        >
                          <span className="font-display text-2xl">{table.label}</span>
                          {tableOrders.length === 1 && (
                            <span className={`text-xs rounded-full px-2.5 py-1 ${STATUS_STYLES[tableOrders[0].status]}`}>
                              {STATUS_LABELS[tableOrders[0].status]}
                            </span>
                          )}
                          {tableOrders.length > 1 && (
                            <span className="text-xs rounded-full px-2.5 py-1 bg-coral/30 text-coral">
                              {tableOrders.length} open
                            </span>
                          )}
                          {tableBillLabel(tableOrders) && <span className="text-sm text-cream tabular-nums">{tableBillLabel(tableOrders)}</span>}
                          {!table.isActive && <span className="text-xs text-cream/40">Inactive</span>}
                          {stale && (
                            <span className="text-xs text-amber-400" suppressHydrationWarning>
                              {longOpenLabel(stale.createdAt, now)}
                            </span>
                          )}
                        </button>
                        {/* Anchored to the tapped table, not rendered once below every zone: with
                            several zones a page-bottom picker could open off-screen, so the tap
                            looked like it did nothing. col-span-full puts it on the row directly
                            under this table; the grid's dense flow lets the next table back-fill the
                            cell beside this one instead of leaving a hole. */}
                        {pickerTableId === table.id && tableOrders.length > 1 && (
                          <div
                            ref={pickerRef}
                            className="col-span-full bg-ink2 border border-coral/40 rounded-2xl p-4"
                          >
                            <p className="text-sm text-cream/70 mb-3">
                              {table.label} has {tableOrders.length} open orders — pick one:
                            </p>
                            <div className="flex flex-col gap-2 mb-3">
                              {tableOrders.map((o) => (
                                <button
                                  key={o.id}
                                  type="button"
                                  onClick={() => router.push(`/pos/orders/${o.id}`)}
                                  className="text-sm text-left rounded-xl border border-cream/25 active:border-cream/50 transition-colors px-4 py-3"
                                >
                                  {orderNumberLabel(o)} · {STATUS_LABELS[o.status]}
                                  {isLongOpen(o, now) && <span className="text-amber-400"> · {longOpenLabel(o.createdAt, now)}</span>}
                                </button>
                              ))}
                            </div>
                            <button
                              type="button"
                              onClick={() => setPickerTableId(null)}
                              className="w-full min-h-11 text-sm text-cream/50 active:text-cream/70 transition-colors"
                            >
                              Cancel
                            </button>
                          </div>
                        )}
                      </Fragment>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {visibleTables.length === 0 && <p className="text-cream/50 text-sm">No tables set up yet.</p>}
        </div>
      ) : (
        <div>
          <form onSubmit={handleNewTicket} className="flex flex-col gap-3 mb-6">
            <input
              type="text"
              value={newTicketName}
              onChange={(e) => setNewTicketName(e.target.value)}
              placeholder="Guest name (optional)"
              className="w-full bg-ink2 border border-cream/20 rounded-xl px-4 py-3 text-cream text-base placeholder:text-cream/30 focus:outline-none focus:border-coral"
            />
            <button
              type="submit"
              disabled={creatingTicket}
              className="rounded-xl bg-coral active:bg-coraldeep transition-colors py-3.5 text-base font-medium disabled:opacity-60"
            >
              {creatingTicket ? "Creating…" : "New ticket"}
            </button>
          </form>

          <div className="space-y-2">
            {openTickets.map((order) => (
              <button
                key={order.id}
                type="button"
                onClick={() => router.push(`/pos/orders/${order.id}`)}
                className={`w-full flex items-center justify-between gap-3 bg-ink2 border rounded-2xl p-4 active:bg-cream/5 transition-colors text-left ${
                  isLongOpen(order, now) ? "border-amber-400/60" : "border-cream/10"
                }`}
              >
                <span className="text-cream text-base min-w-0">
                  {ticketHeading(order)} <span className="text-cream/40 text-sm">{orderNumberLabel(order)}</span>
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
              </button>
            ))}
            {openTickets.length === 0 && <p className="text-cream/50 text-sm">No open tickets.</p>}
          </div>
        </div>
      )}
    </div>
  );
}
