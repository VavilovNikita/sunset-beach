"use client";

import { bookingStatusLabel } from "@/lib/bookingStatusLabel";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { adminRequest, adminJsonInit } from "@/lib/adminFetch";
import { BOOKING_CHANNELS, BOOKING_CHANNEL_LABELS } from "@/lib/bookingChannel";
import { parsePartySize } from "@/lib/bookingPurpose";
import { bookingFormError, type BookingFormError, type BookingFormField } from "@/lib/bookingFormError";
import { breakfastFormFrom, parseBreakfast } from "@/lib/bookingBreakfast";
import { statusOptionsNote, needsCancellationConfirm, needsPaymentDialog, selectableStatuses } from "@/lib/bookingStatusChange";
import { useSavedNotice } from "@/lib/useSavedNotice";
import type { Folio, FolioPaymentInput } from "@/lib/posTypes";
import type { BookingChannel, BookingPurpose, BookingStatus, BreakfastRate, OccupancyStatus } from "@/lib/types";
import BookingBreakfastFields from "@/components/admin/BookingBreakfastFields";
import BookingPurposePartyFields from "@/components/admin/BookingPurposePartyFields";
import CancelBookingDialog from "@/components/admin/CancelBookingDialog";
import MarkPaidDialog from "@/components/admin/MarkPaidDialog";
import { formatBaht } from "@/lib/money";

export default function BookingStatusForm({
  bookingId,
  guestName,
  currentStatus,
  occupancyStatus,
  currentPaymentNote,
  currentChannel,
  currentPurpose,
  currentAdults,
  currentChildren,
  currentBreakfastGuests,
  currentBreakfastRate,
  balanceDue,
  folio,
}: {
  bookingId: string;
  guestName: string;
  currentStatus: BookingStatus;
  // A guest who has arrived can't be cancelled (the server answers 409), so the option isn't offered.
  occupancyStatus: OccupancyStatus;
  currentPaymentNote: string | null;
  currentChannel: BookingChannel;
  currentPurpose: BookingPurpose;
  currentAdults: number;
  currentChildren: number;
  // Breakfast per night, null = none (the booking tracker deducts it from the package).
  currentBreakfastGuests: number | null;
  currentBreakfastRate: BreakfastRate | null;
  // Booking.balanceDue - the server's balance, used until/unless the folio itself has loaded.
  balanceDue: string;
  // Purely informational — nothing here writes to paymentNote or blocks
  // saving. null covers both "no POS orders" and "folio failed to load";
  // either way there's nothing safe to warn about, so no banner.
  folio: Folio | null;
}) {
  const router = useRouter();
  const [status, setStatus] = useState<BookingStatus>(currentStatus);
  const [paymentNote, setPaymentNote] = useState(currentPaymentNote ?? "");
  const [channel, setChannel] = useState<BookingChannel>(currentChannel);
  const [purpose, setPurpose] = useState<BookingPurpose>(currentPurpose);
  const [adults, setAdults] = useState(String(currentAdults));
  const [children, setChildren] = useState(String(currentChildren));
  const initialBreakfast = breakfastFormFrom({ breakfastGuests: currentBreakfastGuests, breakfastRate: currentBreakfastRate });
  const [breakfastGuests, setBreakfastGuests] = useState(initialBreakfast.guests);
  const [breakfastRate, setBreakfastRate] = useState(initialBreakfast.rate);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<BookingFormError | null>(null);
  const [confirmingCancel, setConfirmingCancel] = useState(false);
  const [confirmingPaid, setConfirmingPaid] = useState(false);
  const [notice, showNotice, clearNotice] = useSavedNotice();
  // What a change into PAID has to be paid with (the server's figure; see Folio.amountToMarkPaid).
  const amountToMarkPaid = folio?.amountToMarkPaid ?? balanceDue;

  // A check made here, before anything is sent.
  function ownError(message: string): BookingFormError {
    return { field: null, message, summary: message };
  }

  function edit<T>(field: BookingFormField, set: (value: T) => void, value: T) {
    set(value);
    setError((current) => (current?.field === field ? null : current));
  }

  function fieldError(...fields: BookingFormField[]) {
    return error?.field && fields.includes(error.field) ? <p className="text-xs text-coral mt-1">{error.message}</p> : null;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const party = parsePartySize(adults, children);
    if ("error" in party) {
      setError(ownError(party.error));
      return;
    }
    const breakfast = parseBreakfast({ guests: breakfastGuests, rate: breakfastRate }, party.adults + party.children);
    if (!breakfast.ok) {
      setError(ownError(breakfast.error));
      return;
    }
    setError(null);
    // Moving into CANCELLED asks first, with a reason - see lib/bookingStatusChange.ts.
    if (needsCancellationConfirm(currentStatus, status)) {
      setConfirmingCancel(true);
      return;
    }
    // Moving into PAID while money is owed asks for the payment first - PAID never writes it off.
    if (needsPaymentDialog(currentStatus, status, amountToMarkPaid)) {
      setConfirmingPaid(true);
      return;
    }
    save(null);
  }

  async function save(cancellationReason: string | null, payment?: FolioPaymentInput) {
    const party = parsePartySize(adults, children);
    if ("error" in party) return;
    const breakfast = parseBreakfast({ guests: breakfastGuests, rate: breakfastRate }, party.adults + party.children);
    if (!breakfast.ok) return;
    setSaving(true);
    setError(null);
    clearNotice();

    const result = await adminRequest(
      `/bookings/${bookingId}`,
      adminJsonInit("PATCH", {
        status,
        paymentNote: paymentNote || null,
        channel,
        purpose,
        adults: party.adults,
        children: party.children,
        breakfastGuests: breakfast.breakfastGuests,
        breakfastRate: breakfast.breakfastRate,
        ...(cancellationReason ? { cancellationReason } : {}),
        ...(payment ? { payment } : {}),
      }),
      "Could not update booking."
    );

    setSaving(false);

    if (!result.ok) {
      // Everything typed stays as it is, the refusal beside the field the server named. A refused cancel or payment
      // keeps its dialog open with the sentence in it.
      setError(bookingFormError(result.error, result.body));
      return;
    }
    setConfirmingCancel(false);
    setConfirmingPaid(false);
    showNotice(cancellationReason ? "Booking cancelled." : payment ? "Payment recorded, booking marked paid." : "Saved.");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4 bg-ink2/40 border border-cream/10 rounded-xl p-5">
      <div>
        <label className="eyebrow text-cream/60 block mb-1">Status</label>
        <select
          value={status}
          onChange={(e) => edit("status", setStatus, e.target.value as BookingStatus)}
          className="w-full bg-ink2 border border-cream/20 rounded-lg px-3 py-2 text-sm"
        >
          {selectableStatuses(currentStatus, occupancyStatus).map((s) => (
            <option key={s} value={s}>
              {bookingStatusLabel(s)}
            </option>
          ))}
        </select>
        {statusOptionsNote(currentStatus, occupancyStatus) && (
          <p className="text-xs text-cream/50 mt-1">{statusOptionsNote(currentStatus, occupancyStatus)}</p>
        )}
        {fieldError("status")}
      </div>

      {/* PAID needs a payment behind it: Save opens a dialog that collects it (amount pre-filled
          from the server, method chosen), and the payment and the status change are saved
          together. Money taken at the desk can equally go through the folio form below, which sets
          PAID by itself once the room is covered. */}
      {needsPaymentDialog(currentStatus, status, amountToMarkPaid) && (
        <p className="text-sm text-coral bg-coral/10 border border-coral/30 rounded-lg px-3 py-2">
          {formatBaht(amountToMarkPaid)} is still owed. Saving as Paid asks how it was collected and records
          that payment with the status.
        </p>
      )}

      <div>
        <label className="eyebrow text-cream/60 block mb-1">Channel</label>
        <select
          value={channel}
          onChange={(e) => edit("channel", setChannel, e.target.value as BookingChannel)}
          className="w-full bg-ink2 border border-cream/20 rounded-lg px-3 py-2 text-sm"
        >
          {BOOKING_CHANNELS.map((c) => (
            <option key={c} value={c}>
              {BOOKING_CHANNEL_LABELS[c]}
            </option>
          ))}
        </select>
        {fieldError("channel")}
      </div>

      <BookingPurposePartyFields
        purpose={purpose}
        onPurposeChange={(v) => edit("purpose", setPurpose, v)}
        adults={adults}
        onAdultsChange={(v) => edit("adults", setAdults, v)}
        childCount={children}
        onChildCountChange={(v) => edit("children", setChildren, v)}
        inputClassName="w-full bg-ink2 border border-cream/20 rounded-lg px-3 py-2 text-sm"
      />
      {fieldError("purpose", "adults", "children")}

      <BookingBreakfastFields
        guests={breakfastGuests}
        onGuestsChange={(v) => edit("breakfastGuests", setBreakfastGuests, v)}
        rate={breakfastRate}
        onRateChange={(v) => edit("breakfastRate", setBreakfastRate, v)}
        inputClassName="w-full bg-ink2 border border-cream/20 rounded-lg px-3 py-2 text-sm"
      />
      {fieldError("breakfastGuests", "breakfastRate")}

      <div>
        <label className="eyebrow text-cream/60 block mb-1">Payment note</label>
        <textarea
          rows={3}
          value={paymentNote}
          onChange={(e) => edit("paymentNote", setPaymentNote, e.target.value)}
          placeholder="e.g. terminal receipt #4471 — never enter the guest's card number"
          className="w-full bg-transparent border-b border-cream/25 py-2 text-cream text-sm placeholder:text-cream/30 focus:outline-none focus:border-coral resize-none"
        />
        {fieldError("paymentNote")}
      </div>

      {error && !confirmingCancel && !confirmingPaid && <p className="text-sm text-coral">{error.summary}</p>}

      <div className="flex items-center gap-4">
        <button
          type="submit"
          disabled={saving}
          className="rounded-full bg-coral hover:bg-coraldeep transition-colors px-6 py-2.5 text-sm font-medium disabled:opacity-60"
        >
          {saving ? "Saving…" : "Save"}
        </button>
        {notice && (
          <span role="status" className="text-sm text-cream/70">
            ✓ {notice}
          </span>
        )}
      </div>

      {confirmingPaid && (
        <MarkPaidDialog
          guestName={guestName}
          amountDue={amountToMarkPaid}
          saving={saving}
          error={error?.message ?? null}
          onConfirm={(payment) => save(null, payment)}
          onBack={() => {
            setConfirmingPaid(false);
            setError(null);
          }}
        />
      )}

      {confirmingCancel && (
        <CancelBookingDialog
          guestName={guestName}
          wasPaid={currentStatus === "PAID"}
          saving={saving}
          error={error?.message ?? null}
          onConfirm={(reason) => save(reason)}
          onBack={() => {
            setConfirmingCancel(false);
            setError(null);
          }}
        />
      )}
    </form>
  );
}
