"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ADMIN_API_URL } from "@/lib/backend";
import { usePolling } from "@/lib/usePolling";
import { STATUS_LABELS, STATUS_STYLES, ZONE_LABELS } from "@/lib/posOrders";
import type { Order, Table, Zone } from "@/lib/posTypes";

const ZONES: Zone[] = ["RESTAURANT", "BAR", "SPA", "POOL", "ROOM_SERVICE"];

// Active orders are fetched as two single-status calls (status=OPEN,
// status=SENT) rather than one call for "everything ever" — the contract
// only documents a single `status` value per request, and this keeps the
// board from pulling the whole order history on every poll.
async function fetchActive(): Promise<{ tables: Table[]; orders: Order[] }> {
  const [tablesRes, openRes, sentRes] = await Promise.all([
    fetch(`${ADMIN_API_URL}/tables`, { credentials: "include" }),
    fetch(`${ADMIN_API_URL}/orders?status=OPEN`, { credentials: "include" }),
    fetch(`${ADMIN_API_URL}/orders?status=SENT`, { credentials: "include" }),
  ]);
  const [tables, openOrders, sentOrders] = await Promise.all([
    tablesRes.json(),
    openRes.json(),
    sentRes.json(),
  ]);
  return { tables, orders: [...openOrders, ...sentOrders] };
}

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

  async function refetch() {
    const data = await fetchActive();
    setTables(data.tables);
    setOrders(data.orders);
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
    setCreatingTableId(table.id);
    const res = await fetch(`${ADMIN_API_URL}/orders`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tableId: table.id }),
    });
    setCreatingTableId(null);
    if (!res.ok) return;
    const order = await res.json();
    router.push(`/admin/pos/orders/${order.id}`);
  }

  async function handleNewTicket(e: React.FormEvent) {
    e.preventDefault();
    setCreatingTicket(true);
    const res = await fetch(`${ADMIN_API_URL}/orders`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ guestName: newTicketName || undefined }),
    });
    setCreatingTicket(false);
    if (!res.ok) return;
    const order = await res.json();
    router.push(`/admin/pos/orders/${order.id}`);
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
                    return (
                      <button
                        key={table.id}
                        type="button"
                        disabled={busy}
                        onClick={() => handleTableClick(table)}
                        className={`aspect-square rounded-xl text-sm flex flex-col items-center justify-center gap-1 transition-colors ${
                          tableOrders.length > 0 ? "bg-coral/20 text-coral" : "bg-sea/10 text-cream/70 hover:bg-sea/20"
                        } ${!table.isActive ? "border border-dashed border-cream/30" : ""} ${
                          busy ? "opacity-50" : ""
                        }`}
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
                        #{o.id.slice(-6)} · {STATUS_LABELS[o.status]}
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
          {visibleTables.length === 0 && <p className="text-cream/50 text-sm">No tables set up yet.</p>}
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
                className="flex items-center justify-between bg-ink2/40 border border-cream/10 rounded-xl p-4 hover:bg-cream/5 transition-colors"
              >
                <span className="text-cream">{order.guestName ?? `Ticket #${order.id.slice(-6)}`}</span>
                <span className={`text-xs rounded-full px-2.5 py-1 ${STATUS_STYLES[order.status]}`}>
                  {order.status}
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
