"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePolling } from "@/lib/usePolling";
import { fetchCurrentShift, fetchShift, openShift, closeShift } from "@/lib/pos/shiftsClient";
import PosAttributedConfirm from "@/components/pos/PosAttributedConfirm";
import type { Role } from "@/lib/session";
import type { ShiftSummary } from "@/lib/posTypes";

const ROLE_LABELS: Record<Role, string> = { WAITER: "Waiter", CASHIER: "Cashier", MANAGER: "Manager", ADMIN: "Admin" };

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-ink2 border border-cream/10 rounded-2xl p-4">
      <p className="eyebrow text-cream/50 mb-1">{label}</p>
      <p className="font-display italic text-xl text-coral">{value}</p>
    </div>
  );
}

// Same logic as the admin ShiftPanel (per-user /shifts/current, 409 on close means "something is
// still open somewhere in the system") — no CSV export link here, that's a desktop/manager task
// staying in the admin section. Closing (a money-affecting action - it reconciles this cashier's
// cash drawer against everything they took during the shift) is a two-step review-then-confirm,
// same pattern as order payment, so the identity it'll be recorded under is shown right before
// it's committed - see PosAttributedConfirm's comment for why that matters on a shared device.
export default function PosShiftPanel({ actorEmail, actorRole }: { actorEmail: string; actorRole: Role }) {
  const [shift, setShift] = useState<ShiftSummary | null>(null);
  const [checked, setChecked] = useState(false);
  const [openingFloat, setOpeningFloat] = useState("");
  const [closingCounted, setClosingCounted] = useState("");
  const [notes, setNotes] = useState("");
  const [reviewingClose, setReviewingClose] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [blockedByOpenOrders, setBlockedByOpenOrders] = useState(false);

  async function refetchCurrent() {
    const result = await fetchCurrentShift();
    if (!result.ok) {
      setChecked(true);
      return;
    }
    if (result.data === null) {
      setShift(null);
      setChecked(true);
      return;
    }
    const full = await fetchShift(result.data.id);
    setShift(full.ok ? full.data : result.data);
    setChecked(true);
  }

  useEffect(() => {
    refetchCurrent();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  usePolling(refetchCurrent, 20000, shift?.status === "OPEN");

  async function handleOpen(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const result = await openShift({ openingCashFloat: openingFloat ? Number(openingFloat) : undefined });
    setSubmitting(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    const full = await fetchShift(result.data.id);
    setShift(full.ok ? full.data : null);
  }

  function handleReviewClose(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBlockedByOpenOrders(false);
    setReviewingClose(true);
  }

  async function handleConfirmClose() {
    if (!shift) return;
    setSubmitting(true);
    setError(null);
    setBlockedByOpenOrders(false);
    const result = await closeShift(shift.id, {
      closingCashCounted: closingCounted ? Number(closingCounted) : undefined,
      notes: notes || undefined,
    });
    setSubmitting(false);
    if (!result.ok) {
      if (result.status === 409) {
        setBlockedByOpenOrders(true);
        return;
      }
      setError(result.error);
      return;
    }
    setReviewingClose(false);
    const full = await fetchShift(result.data.id);
    setShift(full.ok ? full.data : null);
  }

  if (!checked) {
    return <p className="p-4 text-sm text-cream/50">Loading…</p>;
  }

  if (!shift) {
    return (
      <form onSubmit={handleOpen} className="p-4 space-y-4">
        <p className="eyebrow text-cream/60">Open a shift</p>
        <div>
          <label className="eyebrow text-cream/60 block mb-1">Opening cash float (฿)</label>
          <input
            type="number"
            inputMode="decimal"
            min={0}
            value={openingFloat}
            onChange={(e) => setOpeningFloat(e.target.value)}
            className="w-full bg-ink2 border border-cream/20 rounded-xl px-4 py-3 text-cream text-base focus:outline-none focus:border-coral"
          />
        </div>
        {error && <p className="text-sm text-coral">{error}</p>}
        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-xl bg-coral active:bg-coraldeep transition-colors py-3.5 text-base font-medium disabled:opacity-60"
        >
          {submitting ? "Opening…" : "Open shift"}
        </button>
      </form>
    );
  }

  return (
    <div className="p-4">
      <div className="grid grid-cols-2 gap-3 mb-6">
        <StatTile label="Cash" value={`฿${Number(shift.totals.cash).toLocaleString("en-US")}`} />
        <StatTile label="Card" value={`฿${Number(shift.totals.card).toLocaleString("en-US")}`} />
        <StatTile label="Room charge" value={`฿${Number(shift.totals.roomCharge).toLocaleString("en-US")}`} />
        <StatTile label="Payments" value={String(shift.totals.paymentCount)} />
      </div>

      {shift.status === "OPEN" ? (
        reviewingClose ? (
          <PosAttributedConfirm
            title="Close shift"
            detail={closingCounted ? `฿${Number(closingCounted).toLocaleString("en-US")} counted` : undefined}
            actorEmail={actorEmail}
            actorRole={ROLE_LABELS[actorRole]}
            confirmLabel="Confirm close"
            busy={submitting}
            error={blockedByOpenOrders ? null : error}
            onConfirm={handleConfirmClose}
            onCancel={() => {
              setReviewingClose(false);
              setError(null);
              setBlockedByOpenOrders(false);
            }}
          />
        ) : (
          <form onSubmit={handleReviewClose} className="space-y-4">
            <p className="eyebrow text-cream/60">Close shift</p>
            <div>
              <label className="eyebrow text-cream/60 block mb-1">Counted cash (฿)</label>
              <input
                type="number"
                inputMode="decimal"
                min={0}
                value={closingCounted}
                onChange={(e) => setClosingCounted(e.target.value)}
                className="w-full bg-ink2 border border-cream/20 rounded-xl px-4 py-3 text-cream text-base focus:outline-none focus:border-coral"
              />
            </div>
            <div>
              <label className="eyebrow text-cream/60 block mb-1">Notes</label>
              <textarea
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full bg-ink2 border border-cream/20 rounded-xl px-4 py-3 text-cream text-base focus:outline-none focus:border-coral resize-none"
              />
            </div>
            <button
              type="submit"
              className="w-full rounded-xl bg-coral active:bg-coraldeep transition-colors py-3.5 text-base font-medium"
            >
              Review &amp; close
            </button>
          </form>
        )
      ) : (
        <p className="text-sm text-cream/50">Shift closed.</p>
      )}

      {blockedByOpenOrders && (
        <p className="mt-3 text-sm text-coral">
          Can&rsquo;t close — there are still open orders somewhere.{" "}
          <Link href="/pos" className="underline underline-offset-4">
            View orders →
          </Link>
        </p>
      )}
    </div>
  );
}
