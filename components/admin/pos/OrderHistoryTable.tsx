"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { STATUS_LABELS, STATUS_STYLES, PAYMENT_METHOD_LABELS } from "@/lib/posOrders";
import type { Order, Table } from "@/lib/posTypes";

// Staff filter is client-side, narrowing rows already fetched for the chosen period/status/table -
// same reasoning as ShiftHistoryTable: GET /users is ADMIN-only, so the dropdown's options come
// from openedByEmail on the rows themselves, not a separate staff lookup.
export default function OrderHistoryTable({ orders, tables }: { orders: Order[]; tables: Table[] }) {
  const [staffFilter, setStaffFilter] = useState("");

  const tablesById = useMemo(() => new Map(tables.map((t) => [t.id, t])), [tables]);

  const staffOptions = useMemo(() => {
    const byId = new Map<string, string>();
    for (const o of orders) byId.set(o.openedByUserId, o.openedByEmail);
    return [...byId.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [orders]);

  const filtered = staffFilter ? orders.filter((o) => o.openedByUserId === staffFilter) : orders;

  if (orders.length === 0) {
    return <p className="text-sm text-cream/50">No orders match these filters.</p>;
  }

  return (
    <div>
      <div className="mb-5">
        <label className="eyebrow text-cream/60 block mb-1">Staff</label>
        <select
          value={staffFilter}
          onChange={(e) => setStaffFilter(e.target.value)}
          className="bg-ink2 border border-cream/20 rounded-lg px-3 py-2 text-sm"
        >
          <option value="">All staff</option>
          {staffOptions.map(([id, email]) => (
            <option key={id} value={id}>
              {email}
            </option>
          ))}
        </select>
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm text-cream/50">No orders for this staff member in these filters.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-cream/40 border-b border-cream/10">
                <th className="py-2 pr-4 font-normal">Opened</th>
                <th className="py-2 pr-4 font-normal">Table / Guest</th>
                <th className="py-2 pr-4 font-normal">Staff</th>
                <th className="py-2 pr-4 font-normal">Status</th>
                <th className="py-2 pr-4 font-normal">Payment</th>
                <th className="py-2 pr-4 font-normal text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((o) => (
                <tr key={o.id} className="border-b border-cream/5">
                  <td className="py-3 pr-4 whitespace-nowrap">
                    <Link
                      href={`/admin/pos/orders/${o.id}`}
                      className="text-sea hover:text-coral transition-colors underline underline-offset-4"
                    >
                      {o.createdAt.slice(0, 16).replace("T", " ")}
                    </Link>
                  </td>
                  <td className="py-3 pr-4 text-cream/70">
                    {o.tableId ? (tablesById.get(o.tableId)?.label ?? "Deleted table") : (o.guestName ?? `Ticket #${o.id.slice(-6)}`)}
                  </td>
                  <td className="py-3 pr-4 text-cream/70">{o.openedByEmail}</td>
                  <td className="py-3 pr-4">
                    <span className={`text-xs rounded-full px-2.5 py-1 ${STATUS_STYLES[o.status]}`}>{STATUS_LABELS[o.status]}</span>
                  </td>
                  <td className="py-3 pr-4 text-cream/70">{o.paymentMethod ? PAYMENT_METHOD_LABELS[o.paymentMethod] : "—"}</td>
                  <td className="py-3 pr-4 text-right text-cream/70">฿{Number(o.total).toLocaleString("en-US")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
