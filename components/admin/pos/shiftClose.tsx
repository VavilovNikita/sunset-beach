"use client";

import { useState } from "react";
import Link from "next/link";
import { adminRequest, adminJsonInit } from "@/lib/adminFetch";
import { normalizeMoneyInput } from "@/lib/moneyInput";
import UnsettledOrdersNotice, { useUnsettledOrders } from "@/components/pos/UnsettledOrdersNotice";
import { splitUnsettledOrders } from "@/lib/shiftOrders";
import { closeNoteMissing, closeNoteRequired, reconcileCash } from "@/lib/shiftReconciliation";
import type { ShiftSummary } from "@/lib/posTypes";
import { formatBaht } from "@/lib/money";

// Counting a drawer and closing its shift, in the office admin: the same fields and the same rules for one's own shift
// (ShiftPanel) and for another person's, closed by a manager from Shift history (CloseShiftButton) - a drawer that
// does not match needs a note, the shift's own open orders block the close.

export function useShiftClose(shift: ShiftSummary | null, onClosed: (closed: { id: string; warning: string | null }) => void) {
  const [counted, setCounted] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // POST /shifts/{id}/close 409s while an order opened by this shift's cashier is still OPEN/SENT;
  // the server's message names them, shown with a link to go clear them.
  const [blockedMessage, setBlockedMessage] = useState<string | null>(null);
  const unsettled = useUnsettledOrders(adminRequest, shift?.status === "OPEN");
  const closeBlocked = splitUnsettledOrders(unsettled ?? [], shift?.openedByUserId).blocking.length > 0;

  async function submit() {
    if (!shift) return;
    if (closeNoteMissing(reconcileCash(shift, counted).discrepancy, notes)) {
      setError("The counted cash differs from the expected amount - write a note saying why before closing the shift.");
      return;
    }
    setSubmitting(true);
    setError(null);
    setBlockedMessage(null);

    const result = await adminRequest<ShiftSummary>(
      `/shifts/${shift.id}/close`,
      adminJsonInit("POST", {
        closingCashCounted: counted ? Number(counted) : undefined,
        notes: notes || undefined,
      }),
      "Could not close shift."
    );

    setSubmitting(false);

    if (!result.ok) {
      if (result.status === 409) {
        setBlockedMessage(result.error);
        return;
      }
      setError(result.error);
      return;
    }
    onClosed({ id: result.data.id, warning: result.data.warning ?? null });
  }

  return { counted, setCounted, notes, setNotes, submitting, error, blockedMessage, unsettled, closeBlocked, submit };
}

export function DiscrepancyBlock({ expectedCash, counted, discrepancy }: { expectedCash: number; counted: number | null; discrepancy: number | null }) {
  if (counted === null) return null;
  const isOff = discrepancy !== null && discrepancy !== 0;
  return (
    <div className={`max-w-md rounded-xl px-5 py-3 space-y-1 border ${isOff ? "bg-coral/10 border-coral/40" : "bg-ink2/40 border-cream/10"}`}>
      <div className="flex items-center justify-between text-sm">
        <span className="text-cream/60">Expected cash</span>
        <span className="text-cream">{formatBaht(expectedCash)}</span>
      </div>
      <div className="flex items-center justify-between text-sm">
        <span className="text-cream/60">Counted cash</span>
        <span className="text-cream">{formatBaht(counted)}</span>
      </div>
      <div className="flex items-center justify-between pt-1 border-t border-cream/10">
        <span className={`text-sm font-medium ${isOff ? "text-coral" : "text-cream/50"}`}>Discrepancy</span>
        <span className={`text-base font-medium ${isOff ? "text-coral" : "text-cream/50"}`}>
          {discrepancy === 0 ? "None" : `${discrepancy! > 0 ? "+" : "−"}${formatBaht(Math.abs(discrepancy!))}`}
        </span>
      </div>
    </div>
  );
}

export function ShiftCloseFields({
  shift,
  close,
  ownerName,
}: {
  shift: ShiftSummary;
  close: ReturnType<typeof useShiftClose>;
  // Whose shift it is, when it need not be the reader's own (closing from Shift history).
  ownerName?: string;
}) {
  const reconciled = reconcileCash(shift, close.counted);
  return (
    <>
      <div>
        <label className="eyebrow text-cream/60 block mb-1">Counted cash (฿)</label>
        <input
          type="text"
          inputMode="decimal"
          aria-label="Counted cash"
          value={close.counted}
          onChange={(e) => close.setCounted(normalizeMoneyInput(e.target.value))}
          className="w-full bg-transparent border-b border-cream/25 py-2 text-cream text-sm focus:outline-none focus:border-coral"
        />
      </div>
      {/* Live, before submitting - a counting mistake is caught while the drawer is still
          open, not after reading it back from the audit log. */}
      <DiscrepancyBlock {...reconciled} />
      <div>
        <label className="eyebrow text-cream/60 block mb-1">
          Notes{closeNoteRequired(reconciled.discrepancy) && <span className="text-coral"> * required - the drawer does not match</span>}
        </label>
        <textarea
          rows={2}
          aria-label="Notes"
          required={closeNoteRequired(reconciled.discrepancy)}
          aria-required={closeNoteRequired(reconciled.discrepancy)}
          value={close.notes}
          onChange={(e) => close.setNotes(e.target.value)}
          className="w-full bg-transparent border-b border-cream/25 py-2 text-cream text-sm focus:outline-none focus:border-coral resize-none"
        />
      </div>
      {close.unsettled && (
        <UnsettledOrdersNotice
          orders={close.unsettled}
          shiftOpenerId={shift.openedByUserId}
          ownerName={ownerName}
          orderHref={(id) => `/admin/pos/orders/${id}`}
        />
      )}
      {close.blockedMessage && !close.closeBlocked && (
        <p className="text-sm text-coral">
          Can&rsquo;t close — {close.blockedMessage}{" "}
          <Link href="/admin/pos" className="underline underline-offset-4">
            View open orders →
          </Link>
        </p>
      )}
      {close.error && <p className="text-sm text-coral">{close.error}</p>}
    </>
  );
}
