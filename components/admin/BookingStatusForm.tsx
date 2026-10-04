"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { adminRequest, adminJsonInit } from "@/lib/adminFetch";
import { BOOKING_CHANNELS, BOOKING_CHANNEL_LABELS } from "@/lib/bookingChannel";
import { parsePartySize } from "@/lib/bookingPurpose";
import { needsCancellationConfirm } from "@/lib/bookingStatusChange";
import { useSavedNotice } from "@/lib/useSavedNotice";
import type { Folio } from "@/lib/posTypes";
import type { BookingChannel, BookingPurpose, BookingStatus } from "@/lib/types";
import BookingPurposePartyFields from "@/components/admin/BookingPurposePartyFields";
import CancelBookingDialog from "@/components/admin/CancelBookingDialog";

const STATUSES = ["NEW", "CONFIRMED", "PAID", "CANCELLED"] as const;

export default function BookingStatusForm({
  bookingId,
  guestName,
  currentStatus,
  currentPaymentNote,
  currentChannel,
  currentPurpose,
  currentAdults,
  currentChildren,
  folio,
}: {
  bookingId: string;
  guestName: string;
  currentStatus: BookingStatus;
  currentPaymentNote: string | null;
  currentChannel: BookingChannel;
  currentPurpose: BookingPurpose;
  currentAdults: number;
  currentChildren: number;
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
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmingCancel, setConfirmingCancel] = useState(false);
  const [notice, showNotice, clearNotice] = useSavedNotice();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const party = parsePartySize(adults, children);
    if ("error" in party) {
      setError(party.error);
      return;
    }
    setError(null);
    // Moving into CANCELLED asks first, with a reason - see lib/bookingStatusChange.ts.
    if (needsCancellationConfirm(currentStatus, status)) {
      setConfirmingCancel(true);
      return;
    }
    save(null);
  }

  async function save(cancellationReason: string | null) {
    const party = parsePartySize(adults, children);
    if ("error" in party) return;
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
        ...(cancellationReason ? { cancellationReason } : {}),
      }),
      "Could not update booking."
    );

    setSaving(false);

    if (!result.ok) {
      setError(result.error);
      // A failed cancel keeps its dialog open, with the error, so the reason isn't lost.
      if (cancellationReason) return;
      // A dropped connection (or a rejected write) must not leave the form looking like it
      // saved - the select already jumped to the chosen value on change, so on failure it has
      // to jump back to what's actually persisted, or the empty state (no error banner visible
      // at a glance, dropdown showing the new value) reads as a silent success.
      setStatus(currentStatus);
      setPaymentNote(currentPaymentNote ?? "");
      setChannel(currentChannel);
      setPurpose(currentPurpose);
      setAdults(String(currentAdults));
      setChildren(String(currentChildren));
      return;
    }
    setConfirmingCancel(false);
    showNotice(cancellationReason ? "Booking cancelled." : "Saved.");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4 max-w-md bg-ink2/40 border border-cream/10 rounded-xl p-5">
      <div>
        <label className="eyebrow text-cream/60 block mb-1">Status</label>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as BookingStatus)}
          className="w-full bg-ink2 border border-cream/20 rounded-lg px-3 py-2 text-sm"
        >
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>

      {/* Setting PAID by hand means "the room was collected outside the folio" (OTA, bank
          transfer) - the folio then stops counting it. Money taken at the desk goes through the
          folio form, which sets PAID by itself once the room is covered. */}
      {status === "PAID" && currentStatus !== "PAID" && folio && Number(folio.balanceDue) > 0 && (
        <p className="text-sm text-coral bg-coral/10 border border-coral/30 rounded-lg px-3 py-2">
          Paid means the room was collected outside the folio (OTA, bank transfer). If the guest is paying at the desk, record it
          in the folio below instead — the booking turns Paid by itself once the room is covered.
          {Number(folio.roomChargesTotal) > 0 &&
            ` POS room charges of ฿${Number(folio.roomChargesTotal).toLocaleString("en-US")} stay owed either way.`}
        </p>
      )}

      <div>
        <label className="eyebrow text-cream/60 block mb-1">Channel</label>
        <select
          value={channel}
          onChange={(e) => setChannel(e.target.value as BookingChannel)}
          className="w-full bg-ink2 border border-cream/20 rounded-lg px-3 py-2 text-sm"
        >
          {BOOKING_CHANNELS.map((c) => (
            <option key={c} value={c}>
              {BOOKING_CHANNEL_LABELS[c]}
            </option>
          ))}
        </select>
      </div>

      <BookingPurposePartyFields
        purpose={purpose}
        onPurposeChange={setPurpose}
        adults={adults}
        onAdultsChange={setAdults}
        childCount={children}
        onChildCountChange={setChildren}
        inputClassName="w-full bg-ink2 border border-cream/20 rounded-lg px-3 py-2 text-sm"
      />

      <div>
        <label className="eyebrow text-cream/60 block mb-1">Payment note</label>
        <textarea
          rows={3}
          value={paymentNote}
          onChange={(e) => setPaymentNote(e.target.value)}
          placeholder="e.g. terminal receipt #4471 — never enter the guest's card number"
          className="w-full bg-transparent border-b border-cream/25 py-2 text-cream text-sm placeholder:text-cream/30 focus:outline-none focus:border-coral resize-none"
        />
      </div>

      {error && !confirmingCancel && <p className="text-sm text-coral">{error}</p>}

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

      {confirmingCancel && (
        <CancelBookingDialog
          guestName={guestName}
          wasPaid={currentStatus === "PAID"}
          saving={saving}
          error={error}
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
