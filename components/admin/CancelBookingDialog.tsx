"use client";

import { useState } from "react";
import ConfirmDialog from "@/components/admin/ConfirmDialog";
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
    <ConfirmDialog
      eyebrow="Cancel booking"
      title={`Cancel ${guestName}’s booking?`}
      confirmLabel="Cancel booking"
      busyLabel="Cancelling…"
      backLabel="Keep booking"
      busy={saving}
      error={error}
      onConfirm={handleConfirm}
      onBack={onBack}
    >
      <p className="text-sm text-cream/60 -mt-3">
        The room is released for these dates
        {wasPaid ? ", and the room payment recorded for this booking is reversed in the ledger" : ""}. The guest is emailed if
        there&rsquo;s an email address for them.
      </p>
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
    </ConfirmDialog>
  );
}
