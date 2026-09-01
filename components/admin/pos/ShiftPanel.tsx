"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ADMIN_API_URL } from "@/lib/backend";
import { adminRequest, adminJsonInit } from "@/lib/adminFetch";
import { usePolling } from "@/lib/usePolling";
import StatCard from "@/components/admin/StatCard";
import type { ShiftSummary } from "@/lib/posTypes";

// expectedCash/discrepancy are never returned by the API - the backend computes the same
// arithmetic (openingFloat + cash payments, counted - expected) three separate times
// (SHIFT_CLOSED audit summary, the printed Z-report, the CSV export - see ShiftService) but
// never puts it on the Shift/ShiftSummary response itself, so the one thing shift close is
// actually FOR (does the drawer match) was only ever visible after the fact, in the audit log.
// Every input this needs (openingCashFloat, totals.cash) is already on ShiftSummary, so this
// is computed here rather than waiting on a backend field - kept in lockstep with
// ShiftService#describeShiftClose/buildZReportPayload if either changes. Same helper as
// components/pos/PosShiftPanel.tsx's PosShiftPanel - not shared, on the same precedent as the
// rest of this admin/pos split (different layout components, StatCard vs StatTile).
function reconcileCash(shift: ShiftSummary, countedInput: string) {
  const expectedCash = Number(shift.openingCashFloat ?? 0) + Number(shift.totals.cash);
  const counted = shift.closingCashCounted != null ? Number(shift.closingCashCounted) : countedInput ? Number(countedInput) : null;
  const discrepancy = counted !== null ? counted - expectedCash : null;
  return { expectedCash, counted, discrepancy };
}

function DiscrepancyBlock({ expectedCash, counted, discrepancy }: { expectedCash: number; counted: number | null; discrepancy: number | null }) {
  if (counted === null) return null;
  const isOff = discrepancy !== null && discrepancy !== 0;
  return (
    <div className={`max-w-md rounded-xl px-5 py-3 space-y-1 border ${isOff ? "bg-coral/10 border-coral/40" : "bg-ink2/40 border-cream/10"}`}>
      <div className="flex items-center justify-between text-sm">
        <span className="text-cream/60">Expected cash</span>
        <span className="text-cream">฿{expectedCash.toLocaleString("en-US")}</span>
      </div>
      <div className="flex items-center justify-between text-sm">
        <span className="text-cream/60">Counted cash</span>
        <span className="text-cream">฿{counted.toLocaleString("en-US")}</span>
      </div>
      <div className="flex items-center justify-between pt-1 border-t border-cream/10">
        <span className={`text-sm font-medium ${isOff ? "text-coral" : "text-cream/50"}`}>Discrepancy</span>
        <span className={`text-base font-medium ${isOff ? "text-coral" : "text-cream/50"}`}>
          {discrepancy === 0 ? "None" : `${discrepancy! > 0 ? "+" : "−"}฿${Math.abs(discrepancy!).toLocaleString("en-US")}`}
        </span>
      </div>
    </div>
  );
}

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
  //
  // React (Strict Mode in dev, but the same shape can happen from a real double-navigation)
  // mounts this component and runs its effects twice - two concurrent GET /shifts/current calls
  // race, and without a guard the response that resolves *second* could be the stale one,
  // landing after the real answer - or, worse, arrive so out of order that `checked` never
  // actually gets set from the call that mattered, leaving the screen on "Loading…"
  // indefinitely. Each call stamps the request counter and only applies its result if nothing
  // newer has started since - the standard "latest request wins" fix; it also protects the 20s
  // polling tick against an old response arriving after a newer one already updated the screen.
  const requestIdRef = useRef(0);

  async function refetchCurrent() {
    const requestId = ++requestIdRef.current;
    const result = await adminRequest<ShiftSummary>("/shifts/current", undefined, "");
    if (requestIdRef.current !== requestId) return;
    if (result.status === 404) {
      setShift(null);
      setChecked(true);
      return;
    }
    if (!result.ok) {
      setChecked(true);
      return;
    }
    const full = await adminRequest<ShiftSummary>(`/shifts/${result.data.id}`, undefined, "");
    if (requestIdRef.current !== requestId) return;
    setShift(full.ok ? full.data : result.data);
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

    const result = await adminRequest<ShiftSummary>(
      "/shifts/open",
      adminJsonInit("POST", { openingCashFloat: openingFloat ? Number(openingFloat) : undefined }),
      "Could not open shift."
    );

    setSubmitting(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }
    const full = await adminRequest<ShiftSummary>(`/shifts/${result.data.id}`, undefined, "");
    setShift(full.ok ? full.data : result.data);
  }

  // Deliberately no "will be recorded as" confirm step before this money-affecting submit -
  // see components/admin/pos/OrderTicket.tsx's handleClose comment (this screen is reached from
  // the same till-bound context, not a handed-around phone).
  async function handleClose(e: React.FormEvent) {
    e.preventDefault();
    if (!shift) return;
    setSubmitting(true);
    setError(null);
    setBlockedByOpenOrders(false);

    const result = await adminRequest<ShiftSummary>(
      `/shifts/${shift.id}/close`,
      adminJsonInit("POST", {
        closingCashCounted: closingCounted ? Number(closingCounted) : undefined,
        notes: notes || undefined,
      }),
      "Could not close shift."
    );

    setSubmitting(false);

    if (!result.ok) {
      if (result.status === 409) {
        setBlockedByOpenOrders(true);
        return;
      }
      setError(result.error);
      return;
    }
    // POST .../close returns a plain Shift, not a ShiftSummary — no `totals`,
    // which the stat cards below render unconditionally. Same shape gap as
    // /shifts/current, fixed the same way: fetch the full summary before
    // rendering it.
    const full = await adminRequest<ShiftSummary>(`/shifts/${result.data.id}`, undefined, "");
    setShift(full.ok ? full.data : result.data);
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

  const reconciled = reconcileCash(shift, closingCounted);

  return (
    <div className="max-w-2xl">
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
        <StatCard label="Cash" value={`฿${Number(shift.totals.cash).toLocaleString("en-US")}`} />
        <StatCard label="Card" value={`฿${Number(shift.totals.card).toLocaleString("en-US")}`} />
        <StatCard label="Room charge" value={`฿${Number(shift.totals.roomCharge).toLocaleString("en-US")}`} />
        <StatCard label="Payments" value={String(shift.totals.paymentCount)} />
      </div>

      {/* /admin/pos/orders (like GET /shifts itself) is MANAGER+ - canExport already carries
          exactly that check, reused here rather than showing a CASHIER a link that 403s. */}
      {canExport && (
        <Link
          href={`/admin/pos/orders?shiftId=${shift.id}`}
          className="block text-sm text-sea hover:text-coral transition-colors underline underline-offset-4 mb-8"
        >
          Orders in this shift →
        </Link>
      )}

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
          {/* Live, before submitting - a counting mistake is caught while the drawer is still
              open, not after reading it back from the audit log. */}
          <DiscrepancyBlock {...reconciled} />
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
        <div className="space-y-3">
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
          <DiscrepancyBlock {...reconciled} />
        </div>
      )}
    </div>
  );
}
