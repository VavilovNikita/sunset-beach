"use client";

import { useState } from "react";
import { CANCELLATION_REASON_MAX, validateCancellationReason } from "@/lib/bookingStatusChange";

// Asked before a booking is saved as CANCELLED, from either booking edit form. The reason is
// required here and recorded on the cancellation's history entry (BookingStatusInput
// .cancellationReason). Not a drag, so no from/to summary - just who, and what cancelling does.
export default function CancelBookingDialog({
  guestName,
  wasPaid,
  saving,
  error,
  onConfirm,
  onBack,
}: {
  guestName: string;
  wasPaid: boolean;
  saving: boolean;
  // A failed save, shown here next to the button that triggered it.
  error: string | null;
  onConfirm: (reason: string) => void;
  onBack: () => void;
}) {
  const [reason, setReason] = useState("");
  const [reasonError, setReasonError] = useState<string | null>(null);

  function handleConfirm() {
    const problem = validateCancellationReason(reason);
    setReasonError(problem);
    if (problem) return;
    onConfirm(reason.trim());
  }

  return (
    <div className="fixed inset-0 z-[60] bg-ink/80 flex items-center justify-center p-4" onClick={onBack}>
      <div className="bg-ink2 border border-coral/40 rounded-xl p-6 max-w-md w-full space-y-4" onClick={(e) => e.stopPropagation()}>
        <div>
          <p className="eyebrow text-coral mb-1">Cancel booking</p>
          <p className="text-cream">Cancel {guestName}&rsquo;s booking?</p>
          <p className="text-sm text-cream/60 mt-1">
            The room is released for these dates
            {wasPaid ? ", and the room payment recorded for this booking is reversed in the ledger" : ""}. The guest is emailed if
            there&rsquo;s an email address for them.
          </p>
        </div>
        <div>
          <label className="eyebrow text-cream/60 block mb-1">
            Reason <span className="text-coral">*</span>
          </label>
          <textarea
            rows={3}
            value={reason}
            maxLength={CANCELLATION_REASON_MAX}
            onChange={(e) => setReason(e.target.value)}
            autoFocus
            placeholder="e.g. guest's flight was cancelled"
            className={`w-full bg-ink border rounded-lg px-3 py-2 text-sm placeholder:text-cream/30 ${reasonError ? "border-coral" : "border-cream/20"}`}
          />
          {reasonError && <p className="text-xs text-coral mt-1">{reasonError}</p>}
        </div>
        {error && <p className="text-sm text-coral">{error}</p>}
        <div className="flex gap-3">
          <button
            type="button"
            onClick={handleConfirm}
            disabled={saving}
            className="rounded-full bg-coral hover:bg-coraldeep transition-colors px-5 py-2.5 text-sm font-medium disabled:opacity-60"
          >
            {saving ? "Cancelling…" : "Cancel booking"}
          </button>
          <button type="button" onClick={onBack} disabled={saving} className="text-sm text-cream/60 hover:text-cream transition-colors">
            Keep booking
          </button>
        </div>
      </div>
    </div>
  );
}
