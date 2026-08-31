"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ADMIN_API_URL } from "@/lib/backend";
import { extractApiError } from "@/lib/apiError";
import { usePolling } from "@/lib/usePolling";
import StatCard from "@/components/admin/StatCard";
import type { ShiftSummary } from "@/lib/posTypes";

export default function ShiftPanel({ canExport }: { canExport: boolean }) {
  const [shift, setShift] = useState<ShiftSummary | null>(null);
  const [checked, setChecked] = useState(false);
  const [openingFloat, setOpeningFloat] = useState("");
  const [closingCounted, setClosingCounted] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // POST /shifts/{id}/close 409s whenever ANY order in the system is still
  // OPEN/SENT — not just orders under this shift — so the generic error
  // body ("Cannot close shift...") would be confusing on its own; this gets
  // its own message with a link to go clear those orders.
  const [blockedByOpenOrders, setBlockedByOpenOrders] = useState(false);

  // /shifts/current works from any device under the same account — no more
  // reason to track a shift id client-side.
  async function refetchCurrent() {
    const res = await fetch(`${ADMIN_API_URL}/shifts/current`, { credentials: "include" });
    if (res.status === 404) {
      setShift(null);
      setChecked(true);
      return;
    }
    if (!res.ok) {
      setChecked(true);
      return;
    }
    const current: ShiftSummary = await res.json();
    const full = await fetch(`${ADMIN_API_URL}/shifts/${current.id}`, { credentials: "include" });
    setShift(full.ok ? await full.json() : current);
    setChecked(true);
  }

  useEffect(() => {
    refetchCurrent();
  }, []);

  usePolling(refetchCurrent, 20000, shift?.status === "OPEN");

  async function handleOpen(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const res = await fetch(`${ADMIN_API_URL}/shifts/open`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ openingCashFloat: openingFloat ? Number(openingFloat) : undefined }),
    });

    setSubmitting(false);

    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setError(extractApiError(data, "Could not open shift."));
      return;
    }
    const opened = await res.json();
    const full = await fetch(`${ADMIN_API_URL}/shifts/${opened.id}`, { credentials: "include" });
    setShift(full.ok ? await full.json() : opened);
  }

  async function handleClose(e: React.FormEvent) {
    e.preventDefault();
    if (!shift) return;
    setSubmitting(true);
    setError(null);
    setBlockedByOpenOrders(false);

    const res = await fetch(`${ADMIN_API_URL}/shifts/${shift.id}/close`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        closingCashCounted: closingCounted ? Number(closingCounted) : undefined,
        notes: notes || undefined,
      }),
    });

    setSubmitting(false);

    if (!res.ok) {
      if (res.status === 409) {
        setBlockedByOpenOrders(true);
        return;
      }
      const data = await res.json().catch(() => null);
      setError(extractApiError(data, "Could not close shift."));
      return;
    }
    // POST .../close returns a plain Shift, not a ShiftSummary — no `totals`,
    // which the stat cards below render unconditionally. Same shape gap as
    // /shifts/current, fixed the same way: fetch the full summary before
    // rendering it.
    const closed = await res.json();
    const full = await fetch(`${ADMIN_API_URL}/shifts/${closed.id}`, { credentials: "include" });
    setShift(full.ok ? await full.json() : closed);
  }

  if (!checked) {
    return <p className="text-sm text-cream/50">Loading…</p>;
  }

  if (!shift) {
    return (
      <form onSubmit={handleOpen} className="max-w-md space-y-4 bg-ink2/40 border border-cream/10 rounded-xl p-5">
        <p className="eyebrow text-cream/60">Open a shift</p>
        <div>
          <label className="eyebrow text-cream/60 block mb-1">Opening cash float (฿)</label>
          <input
            type="number"
            min={0}
            value={openingFloat}
            onChange={(e) => setOpeningFloat(e.target.value)}
            className="w-full bg-transparent border-b border-cream/25 py-2 text-cream text-sm focus:outline-none focus:border-coral"
          />
        </div>
        {error && <p className="text-sm text-coral">{error}</p>}
        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-full bg-coral hover:bg-coraldeep transition-colors py-2.5 text-sm font-medium disabled:opacity-60"
        >
          {submitting ? "Opening…" : "Open shift"}
        </button>
      </form>
    );
  }

  return (
    <div className="max-w-2xl">
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
        <StatCard label="Cash" value={`฿${Number(shift.totals.cash).toLocaleString("en-US")}`} />
        <StatCard label="Card" value={`฿${Number(shift.totals.card).toLocaleString("en-US")}`} />
        <StatCard label="Room charge" value={`฿${Number(shift.totals.roomCharge).toLocaleString("en-US")}`} />
        <StatCard label="Payments" value={String(shift.totals.paymentCount)} />
      </div>

      {shift.status === "OPEN" ? (
        <form onSubmit={handleClose} className="space-y-4 bg-ink2/40 border border-cream/10 rounded-xl p-5">
          <p className="eyebrow text-cream/60">Close shift</p>
          <div>
            <label className="eyebrow text-cream/60 block mb-1">Counted cash (฿)</label>
            <input
              type="number"
              min={0}
              value={closingCounted}
              onChange={(e) => setClosingCounted(e.target.value)}
              className="w-full bg-transparent border-b border-cream/25 py-2 text-cream text-sm focus:outline-none focus:border-coral"
            />
          </div>
          <div>
            <label className="eyebrow text-cream/60 block mb-1">Notes</label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full bg-transparent border-b border-cream/25 py-2 text-cream text-sm focus:outline-none focus:border-coral resize-none"
            />
          </div>
          {blockedByOpenOrders && (
            <p className="text-sm text-coral">
              Can&rsquo;t close — there are still open orders somewhere in the system, not just on this shift.{" "}
              <Link href="/admin/pos" className="underline underline-offset-4">
                View open orders →
              </Link>
            </p>
          )}
          {error && <p className="text-sm text-coral">{error}</p>}
          <button
            type="submit"
            disabled={submitting}
            className="rounded-full bg-coral hover:bg-coraldeep transition-colors px-6 py-2.5 text-sm font-medium disabled:opacity-60"
          >
            {submitting ? "Closing…" : "Close shift"}
          </button>
        </form>
      ) : (
        <p className="text-sm text-cream/50">
          Shift closed.
          {canExport && (
            <>
              {" "}
              <a
                href={`${ADMIN_API_URL}/shifts/${shift.id}/export`}
                className="text-sea hover:text-coral transition-colors underline underline-offset-4"
              >
                Export CSV
              </a>
            </>
          )}
        </p>
      )}
    </div>
  );
}
