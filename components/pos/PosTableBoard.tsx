"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { usePolling } from "@/lib/usePolling";
import { fetchBoardData, createTableOrder, createTicketOrder } from "@/lib/pos/ordersClient";
import { STATUS_LABELS, STATUS_STYLES, ZONE_LABELS } from "@/lib/posOrders";
import type { Order, Table, Zone } from "@/lib/posTypes";

const ZONES: Zone[] = ["RESTAURANT", "BAR", "SPA", "POOL", "ROOM_SERVICE"];

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
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setTables(initialTables);
  }, [initialTables]);

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
    setError(null);
    setCreatingTableId(table.id);
    const result = await createTableOrder(table.id);
    setCreatingTableId(null);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.push(`/pos/orders/${result.data.id}`);
  }

  async function handleNewTicket(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setCreatingTicket(true);
    const result = await createTicketOrder(newTicketName);
    setCreatingTicket(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.push(`/pos/orders/${result.data.id}`);
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
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {zoneTables.map((table) => {
                    const tableOrders = ordersByTableId.get(table.id) ?? [];
                    const busy = creatingTableId === table.id;
                    return (
                      <button
                        key={table.id}
                        type="button"
                        disabled={busy}
                        onClick={() => handleTableClick(table)}
                        className={`min-h-[76px] rounded-2xl text-base flex flex-col items-center justify-center gap-1.5 transition-colors ${
                          tableOrders.length > 0 ? "bg-coral/20 text-coral" : "bg-sea/10 text-cream/80 active:bg-sea/20"
                        } ${!table.isActive ? "border border-dashed border-cream/30" : ""} ${busy ? "opacity-50" : ""}`}
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
                        {!table.isActive && <span className="text-xs text-cream/40">Inactive</span>}
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
                <div className="bg-ink2 border border-cream/10 rounded-2xl p-4">
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
                        #{o.id.slice(-6)} · {STATUS_LABELS[o.status]}
                      </button>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={() => setPickerTableId(null)}
                    className="text-sm text-cream/50 active:text-cream/70 transition-colors py-2"
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
                className="w-full flex items-center justify-between bg-ink2 border border-cream/10 rounded-2xl p-4 active:bg-cream/5 transition-colors"
              >
                <span className="text-cream text-base">{order.guestName ?? `Ticket #${order.id.slice(-6)}`}</span>
                <span className={`text-xs rounded-full px-2.5 py-1 ${STATUS_STYLES[order.status]}`}>
                  {STATUS_LABELS[order.status]}
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
