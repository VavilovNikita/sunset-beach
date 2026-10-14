"use client";

import { useState } from "react";
import ConfirmDialog from "@/components/admin/ConfirmDialog";
import { paidPaymentInput, validatePaidPayment } from "@/lib/bookingStatusChange";
import type { FolioPaymentInput, FolioPaymentMethod } from "@/lib/posTypes";

const METHODS: { value: FolioPaymentMethod; label: string }[] = [
  { value: "CASH", label: "Cash" },
  { value: "CARD", label: "Card" },
  { value: "OTHER", label: "Other (bank transfer, OTA prepayment…)" },
];

// Asked before a booking is saved as PAID while money is still owed, from either booking edit form.
// PAID never writes money off on its own: the payment collected here travels with the status
// change (BookingStatusInput.payment) and the backend records both in one transaction, or neither.
// The amount is the server's figure (`amountDue`) and is shown read-only - the balance is never
// worked out or typed on this side. A guest who pays only part of it is recorded from the folio
// payment form, which takes any amount up to the balance; this dialog settles the booking in full.
export default function MarkPaidDialog({
  guestName,
  amountDue,
  saving,
  error,
  onConfirm,
  onBack,
}: {
  guestName: string;
  amountDue: string;
  saving: boolean;
  // A failed save, shown here next to the button that triggered it.
  error: string | null;
  onConfirm: (payment: FolioPaymentInput) => void;
  onBack: () => void;
}) {
  const [method, setMethod] = useState<FolioPaymentMethod | "">("");
  const amount = amountDue;
  const [problem, setProblem] = useState<string | null>(null);

  function handleConfirm() {
    const invalid = validatePaidPayment(method, amount);
    setProblem(invalid);
    if (invalid || !method) return;
    onConfirm(paidPaymentInput(method, amount));
  }

  return (
    <ConfirmDialog
      eyebrow="Mark as paid"
      title={`Record ${guestName}’s payment`}
      confirmLabel="Record payment and mark paid"
      busyLabel="Saving…"
      backLabel="Back"
      busy={saving}
      error={error}
      onConfirm={handleConfirm}
      onBack={onBack}
    >
      <p className="text-sm text-cream/60 -mt-3">
        ฿{Number(amountDue).toLocaleString("en-US")} is still owed on this booking. A booking is only marked paid with a payment
        behind it - record how it was collected.
      </p>
      <div className="flex gap-3 flex-wrap">
        <div>
          <label className="eyebrow text-cream/60 block mb-1">
            Amount collected <span className="text-coral">*</span>
          </label>
          <input
            type="text"
            readOnly
            aria-readonly="true"
            value={`฿${Number(amount).toLocaleString("en-US")}`}
            title="The amount owed, as the server worked it out"
            className="w-32 bg-ink/60 border border-cream/10 rounded-lg px-3 py-2 text-sm text-cream/80 cursor-default"
          />
        </div>
        <div className="flex-1 min-w-[10rem]">
          <label className="eyebrow text-cream/60 block mb-1">
            Paid by <span className="text-coral">*</span>
          </label>
          <select
            value={method}
            onChange={(e) => setMethod(e.target.value as FolioPaymentMethod | "")}
            autoFocus
            className={`w-full bg-ink border rounded-lg px-3 py-2 text-sm ${problem && !method ? "border-coral" : "border-cream/20"}`}
          >
            <option value="">Choose…</option>
            {METHODS.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
        </div>
      </div>
      {problem && <p className="text-xs text-coral -mt-2">{problem}</p>}
    </ConfirmDialog>
  );
}
