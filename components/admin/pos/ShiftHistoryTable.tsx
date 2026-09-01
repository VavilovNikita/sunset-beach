"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { ShiftListItem } from "@/lib/posTypes";

// The staff filter is client-side, not a second round trip with `staffId` set - GET /shifts
// already returns every shift in the chosen date range (staff count × working days is a small
// dataset, not audit-log scale), so narrowing to one person is just hiding rows already in hand.
// The dropdown's options come from those same rows (distinct openedByUserId/openedByEmail
// pairs) rather than GET /users, which is ADMIN-only - a MANAGER running this page couldn't
// fetch that list anyway.
export default function ShiftHistoryTable({ shifts }: { shifts: ShiftListItem[] }) {
  const [staffFilter, setStaffFilter] = useState("");

  const staffOptions = useMemo(() => {
    const byId = new Map<string, string>();
    for (const s of shifts) byId.set(s.openedByUserId, s.openedByEmail);
    return [...byId.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [shifts]);

  const filtered = staffFilter ? shifts.filter((s) => s.openedByUserId === staffFilter) : shifts;

  if (shifts.length === 0) {
    return <p className="text-sm text-cream/50">No shifts in this period.</p>;
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
        <p className="text-sm text-cream/50">No shifts for this staff member in this period.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-cream/40 border-b border-cream/10">
                <th className="py-2 pr-4 font-normal">Opened</th>
                <th className="py-2 pr-4 font-normal">Staff</th>
                <th className="py-2 pr-4 font-normal">Status</th>
                <th className="py-2 pr-4 font-normal text-right">Cash</th>
                <th className="py-2 pr-4 font-normal text-right">Card</th>
                <th className="py-2 pr-4 font-normal text-right">Room charge</th>
                <th className="py-2 pr-4 font-normal text-right">Expected</th>
                <th className="py-2 pr-4 font-normal text-right">Counted</th>
                <th className="py-2 pr-4 font-normal text-right">Discrepancy</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((s) => {
                const discrepancy = s.discrepancy !== null ? Number(s.discrepancy) : null;
                return (
                  <tr key={s.id} className="border-b border-cream/5">
                    <td className="py-3 pr-4 whitespace-nowrap">
                      <Link
                        href={`/admin/pos/shifts/${s.id}`}
                        className="text-sea hover:text-coral transition-colors underline underline-offset-4"
                      >
                        {s.openedAt.slice(0, 16).replace("T", " ")}
                      </Link>
                    </td>
                    <td className="py-3 pr-4 text-cream/70">{s.openedByEmail}</td>
                    <td className="py-3 pr-4 text-cream/70">{s.status}</td>
                    <td className="py-3 pr-4 text-right text-cream/70">฿{Number(s.totals.cash).toLocaleString("en-US")}</td>
                    <td className="py-3 pr-4 text-right text-cream/70">฿{Number(s.totals.card).toLocaleString("en-US")}</td>
                    <td className="py-3 pr-4 text-right text-cream/70">
                      ฿{Number(s.totals.roomCharge).toLocaleString("en-US")}
                    </td>
                    <td className="py-3 pr-4 text-right text-cream/70">฿{Number(s.expectedCash).toLocaleString("en-US")}</td>
                    <td className="py-3 pr-4 text-right text-cream/70">
                      {s.closingCashCounted !== null ? `฿${Number(s.closingCashCounted).toLocaleString("en-US")}` : "—"}
                    </td>
                    <td
                      className={`py-3 pr-4 text-right font-medium ${
                        discrepancy === null ? "text-cream/40" : discrepancy === 0 ? "text-cream/50" : "text-coral"
                      }`}
                    >
                      {discrepancy === null
                        ? "—"
                        : discrepancy === 0
                          ? "None"
                          : `${discrepancy > 0 ? "+" : "−"}฿${Math.abs(discrepancy).toLocaleString("en-US")}`}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
