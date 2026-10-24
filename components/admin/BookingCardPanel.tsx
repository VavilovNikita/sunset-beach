"use client";

import { useCloseOnBrowserBack } from "@/lib/useCloseOnBrowserBack";
import { useEffect, useState } from "react";
import Link from "next/link";
import { ADMIN_API_URL } from "@/lib/backend";
import { adminRequest, adminJsonInit } from "@/lib/adminFetch";
import { BOOKING_CHANNELS, BOOKING_CHANNEL_LABELS, bookingOriginNote } from "@/lib/bookingChannel";
import { formatDateRange, formatTimestamp } from "@/lib/formatDate";
import { BOOKING_PURPOSE_LABELS, formatPartySize, parsePartySize } from "@/lib/bookingPurpose";
import BookingPurposePartyFields from "@/components/admin/BookingPurposePartyFields";
import { RelocateForm, RepriceSegmentButton, UndoRelocationButton } from "@/components/admin/BookingRelocation";
import { sortUnitsByLabel } from "@/lib/sortRooms";
import OwesBadge from "@/components/admin/OwesBadge";
import CancelBookingDialog from "@/components/admin/CancelBookingDialog";
import MarkPaidDialog from "@/components/admin/MarkPaidDialog";
import { statusOptionsNote, needsCancellationConfirm, needsPaymentDialog, selectableStatuses } from "@/lib/bookingStatusChange";
import { useSavedNotice } from "@/lib/useSavedNotice";
import GuestLinkEditor from "@/components/admin/GuestLinkEditor";
import { BookingScheduleEditor, RoomUnitAssignmentEditor } from "@/components/admin/BookingScheduleEditor";
import type { Booking, BookingChannel, BookingScheduleQuote, Room, RoomUnit, AuditLogEntry } from "@/lib/types";
import type { BookingPosOrder, Folio, FolioPaymentInput } from "@/lib/posTypes";
import { describeAuditActor, humanizeAuditSummary } from "@/lib/auditDisplay";
import ConfirmActionDialog from "@/components/admin/ConfirmActionDialog";

// Slide-in panel opened by clicking a bar on the booking calendar grid - deliberately a fixed-
// width side panel, not a full-screen modal, so reception can still see the grid (neighbouring
// dates/rooms) while working the booking. All edits go through the same endpoints the booking
// detail page and the grid's own drag/resize already use - see lib/bookingScheduleClient.ts and
// lib/bookingRelocationClient.ts - there is no booking-panel-specific write endpoint.
//
// Guest name/email/phone are shown but not editable here: no PATCH exists for those fields on
// any booking-editing surface in this app (only status/paymentNote, schedule, and now
// relocation do), so offering an edit control for them would imply a capability this backend
// doesn't have. The Guest *link* (GuestLinkEditor, right below) is a separate, independent
// thing - it points this booking at a Guest record without ever touching the frozen snapshot
// fields above it.
export default function BookingCardPanel({
  bookingId,
  canManage,
  onClose,
  onChanged,
}: {
  bookingId: string;
  // MANAGER+ - same gate GET /room-units and GET /audit-log already use elsewhere (see the
  // booking detail page's canListUnits). A CASHIER still gets the panel, just without the
  // room-unit picker (relocate/schedule can still target "no unit yet") or the history list.
  canManage: boolean;
  onClose: () => void;
  /** After any change saved from the panel - the grid behind it re-reads, instead of waiting for the panel to close. */
  onChanged?: () => void;
}) {
  useCloseOnBrowserBack(true, onClose); // Back closes the panel instead of leaving the page
  const [booking, setBooking] = useState<Booking | null>(null);
  const [posOrders, setPosOrders] = useState<BookingPosOrder[]>([]);
  const [folio, setFolio] = useState<Folio | null>(null);
  const [auditLog, setAuditLog] = useState<AuditLogEntry[]>([]);
  const [roomUnits, setRoomUnits] = useState<RoomUnit[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  async function refetch() {
    setLoadError(false);
    try {
      const bookingRes = await fetch(`${ADMIN_API_URL}/bookings/${bookingId}`, { credentials: "include" });
      if (!bookingRes.ok) throw new Error("failed");
      const b = (await bookingRes.json()) as Booking;
      setBooking(b);

      const [orders, folioData] = await Promise.all([
        fetch(`${ADMIN_API_URL}/bookings/${bookingId}/pos-orders`, { credentials: "include" })
          .then((r) => (r.ok ? r.json() : []))
          .catch(() => []),
        fetch(`${ADMIN_API_URL}/bookings/${bookingId}/folio`, { credentials: "include" })
          .then((r) => (r.ok ? r.json() : null))
          .catch(() => null),
      ]);
      setPosOrders(orders);
      setFolio(folioData);

      if (canManage) {
        const [units, audit] = await Promise.all([
          fetch(`${ADMIN_API_URL}/room-units?roomId=${b.roomId}`, { credentials: "include" })
            .then((r) => (r.ok ? r.json() : []))
            .catch(() => []),
          fetch(`${ADMIN_API_URL}/audit-log?entityType=BOOKING&entityId=${bookingId}&pageSize=50`, { credentials: "include" })
            .then((r) => (r.ok ? r.json() : { items: [] }))
            .catch(() => ({ items: [] })),
        ]);
        setRoomUnits(sortUnitsByLabel(units.filter((u: RoomUnit) => u.isActive)));
        setAuditLog(audit.items ?? []);
      }
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }

  // Every save in the panel goes through this: reload the panel's own data, then tell the grid, so a
  // moved booking or a new status shows on the calendar while the panel is still open.
  async function refetchAndNotify() {
    await refetch();
    onChanged?.();
  }

  useEffect(() => {
    setLoading(true);
    refetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookingId]);

  return (
    <div className="fixed inset-0 z-40 pointer-events-none">
      {/* No dimming backdrop over the grid on purpose - the whole point of a side panel over a
          modal is that reception keeps the surrounding dates/rooms in view while working this
          booking. Clicking outside the panel still closes it. */}
      <div className="absolute inset-0 pointer-events-auto" onClick={onClose} />
      <div
        className="absolute top-0 right-0 bottom-0 w-full sm:w-[440px] bg-ink2 border-l border-cream/15 shadow-2xl pointer-events-auto overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-5 border-b border-cream/10 flex items-center justify-between sticky top-0 bg-ink2 z-10">
          <p className="eyebrow text-sea">Booking</p>
          <button onClick={onClose} className="text-cream/50 hover:text-cream transition-colors text-xl leading-none">
            ×
          </button>
        </div>

        {loading && <p className="p-5 text-sm text-cream/50">Loading…</p>}
        {loadError && <p className="p-5 text-sm text-coral">Couldn&rsquo;t load this booking.</p>}

        {booking && !loading && (
          <div className="p-5 space-y-6">
            <div>
              <h2 className="font-display italic text-2xl mb-1">{booking.guestName}</h2>
              <p className="text-sm text-cream/50">
                {booking.guestEmail ||
                  (booking.guest?.email ? `${booking.guest.email} (from guest card)` : "No email on file")}
              </p>
              <p className="text-sm text-cream/50">{booking.guestPhone || booking.guest?.phone || "No phone on file"}</p>
              {bookingOriginNote(booking) && <p className="text-xs text-cream/40">Came {bookingOriginNote(booking)}</p>}
              {booking.status === "CANCELLED" && booking.cancellationReason && (
                <p className="text-xs text-coral">Cancelled: {booking.cancellationReason}</p>
              )}
              <p className="text-sm text-cream/50">
                {formatPartySize(booking.adults, booking.children)}
                {booking.purpose !== "STANDARD" && (
                  <span className="ml-2 text-sea">{BOOKING_PURPOSE_LABELS[booking.purpose]}</span>
                )}
              </p>
              <div className="mt-2">
                <GuestLinkEditor booking={booking} onSaved={refetchAndNotify} />
              </div>
              <Link
                href={`/admin/bookings/${booking.id}`}
                className="inline-block mt-2 text-xs text-sea hover:text-coral transition-colors underline underline-offset-4"
              >
                Open full page
              </Link>
            </div>

            <StatusAndNoteEditor booking={booking} folio={folio} onSaved={refetchAndNotify} />

            <SegmentsSection
              booking={booking}
              roomUnits={roomUnits}
              canManage={canManage}
              onSaved={refetchAndNotify}
            />

            <div>
              <p className="eyebrow text-cream/50 mb-2">Folio</p>
              {folio ? (
                <div className="bg-ink border border-cream/10 rounded-xl p-4 text-sm space-y-1">
                  <div className="flex items-center justify-between text-cream/60">
                    <span>Room{Number(folio.earlyDepartureFee) > 0 ? " + early departure" : ""}</span>
                    <span>฿{(Number(folio.roomTotal) + Number(folio.earlyDepartureFee)).toLocaleString("en-US")}</span>
                  </div>
                  <div className="flex items-center justify-between text-cream/60">
                    <span>POS room charges ({folio.roomChargeCount})</span>
                    <span>฿{Number(folio.roomChargesGross).toLocaleString("en-US")}</span>
                  </div>
                  {Number(folio.paidTotal) + Number(folio.settledOutside) > 0 && (
                    <div className="flex items-center justify-between text-cream/60">
                      <span>Paid</span>
                      <span>−฿{(Number(folio.paidTotal) + Number(folio.settledOutside)).toLocaleString("en-US")}</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between pt-2 mt-2 border-t border-cream/10">
                    <span className="font-display italic text-cream">Balance due</span>
                    <span className={`font-display italic text-2xl ${Number(folio.balanceDue) > 0 ? "text-coral" : "text-sea"}`}>
                      ฿{Number(folio.balanceDue).toLocaleString("en-US")}
                    </span>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-cream/40">Couldn&rsquo;t load the folio.</p>
              )}
            </div>

            {posOrders.length > 0 && (
              <div>
                <p className="eyebrow text-cream/50 mb-2">Room charges</p>
                <div className="space-y-2">
                  {posOrders.map((po) => (
                    <div key={po.orderId} className="bg-ink border border-cream/10 rounded-xl p-3 text-sm">
                      <p className="text-cream/70 truncate">{po.items.map((i) => `${i.quantity}× ${i.name}`).join(", ")}</p>
                      <div className="flex items-center justify-between text-xs text-cream/40 mt-1">
                        <span>{formatTimestamp(po.paidAt)}</span>
                        <span className="text-cream">฿{Number(po.amount).toLocaleString("en-US")}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {canManage && (
              <div>
                <p className="eyebrow text-cream/50 mb-2">History</p>
                {auditLog.length === 0 ? (
                  <p className="text-sm text-cream/40">No recorded actions on this booking yet.</p>
                ) : (
                  <div className="space-y-2">
                    {auditLog.map((entry) => (
                      <div key={entry.id} className="bg-ink border border-cream/10 rounded-xl p-3 text-xs">
                        <p className="text-cream/70">{humanizeAuditSummary(entry.summary)}</p>
                        <p className="text-cream/40 mt-1">
                          {formatTimestamp(entry.createdAt)} · {describeAuditActor(entry.actorEmail, entry.actorRole)}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function StatusAndNoteEditor({ booking, folio, onSaved }: { booking: Booking; folio: Folio | null; onSaved: () => void }) {
  const [status, setStatus] = useState(booking.status);
  const [paymentNote, setPaymentNote] = useState(booking.paymentNote ?? "");
  const [channel, setChannel] = useState(booking.channel);
  const [purpose, setPurpose] = useState(booking.purpose);
  const [adults, setAdults] = useState(String(booking.adults));
  const [children, setChildren] = useState(String(booking.children));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmingCancel, setConfirmingCancel] = useState(false);
  const [confirmingPaid, setConfirmingPaid] = useState(false);
  const [notice, showNotice, clearNotice] = useSavedNotice();
  // What a change into PAID has to be paid with (the server's figure; see Folio.amountToMarkPaid).
  const amountToMarkPaid = folio?.amountToMarkPaid ?? booking.balanceDue;

  useEffect(() => {
    setStatus(booking.status);
    setPaymentNote(booking.paymentNote ?? "");
    setChannel(booking.channel);
    setPurpose(booking.purpose);
    setAdults(String(booking.adults));
    setChildren(String(booking.children));
  }, [booking.status, booking.paymentNote, booking.channel, booking.purpose, booking.adults, booking.children]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const party = parsePartySize(adults, children);
    if ("error" in party) {
      setError(party.error);
      return;
    }
    setError(null);
    // Same rule as BookingStatusForm - see lib/bookingStatusChange.ts.
    if (needsCancellationConfirm(booking.status, status)) {
      setConfirmingCancel(true);
      return;
    }
    // Same rule as BookingStatusForm: PAID with money owed asks for the payment first.
    if (needsPaymentDialog(booking.status, status, amountToMarkPaid)) {
      setConfirmingPaid(true);
      return;
    }
    save(null);
  }

  async function save(cancellationReason: string | null, payment?: FolioPaymentInput) {
    const party = parsePartySize(adults, children);
    if ("error" in party) return;
    setSaving(true);
    setError(null);
    clearNotice();
    const result = await adminRequest(
      `/bookings/${booking.id}`,
      adminJsonInit("PATCH", {
        status,
        paymentNote: paymentNote || null,
        channel,
        purpose,
        adults: party.adults,
        children: party.children,
        ...(cancellationReason ? { cancellationReason } : {}),
        ...(payment ? { payment } : {}),
      }),
      "Could not update booking."
    );
    setSaving(false);
    if (!result.ok) {
      setError(result.error);
      if (cancellationReason || payment) return;
      // See BookingStatusForm.tsx's identical note - the select already jumped to the chosen
      // value on change, so a failed save has to jump it back, or the form looks like it saved.
      setStatus(booking.status);
      setPaymentNote(booking.paymentNote ?? "");
      setChannel(booking.channel);
      setPurpose(booking.purpose);
      setAdults(String(booking.adults));
      setChildren(String(booking.children));
      return;
    }
    setConfirmingCancel(false);
    setConfirmingPaid(false);
    showNotice(cancellationReason ? "Booking cancelled." : payment ? "Payment recorded, booking marked paid." : "Saved.");
    onSaved();
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-3 bg-ink border border-cream/10 rounded-xl p-4">
      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="eyebrow text-cream/60">Status</label>
          <OwesBadge balanceDue={booking.balanceDue} owes={booking.owes} />
        </div>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as Booking["status"])}
          className="w-full bg-ink2 border border-cream/20 rounded-lg px-3 py-2 text-sm"
        >
          {selectableStatuses(booking.status, booking.occupancyStatus).map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        {statusOptionsNote(booking.status, booking.occupancyStatus) && (
          <p className="text-xs text-cream/50 mt-1">{statusOptionsNote(booking.status, booking.occupancyStatus)}</p>
        )}
      </div>
      {needsPaymentDialog(booking.status, status, amountToMarkPaid) && (
        <p className="text-xs text-coral bg-coral/10 border border-coral/30 rounded-lg px-3 py-2">
          ฿{Number(amountToMarkPaid).toLocaleString("en-US")} is still owed. Saving as Paid asks how it was collected and records that
          payment with the status.
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
          rows={2}
          value={paymentNote}
          onChange={(e) => setPaymentNote(e.target.value)}
          placeholder="e.g. terminal receipt #4471"
          className="w-full bg-ink2 border border-cream/20 rounded-lg px-3 py-2 text-sm placeholder:text-cream/30"
        />
      </div>
      {error && !confirmingCancel && !confirmingPaid && <p className="text-xs text-coral">{error}</p>}
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={saving}
          className="rounded-full bg-coral hover:bg-coraldeep transition-colors px-5 py-2 text-sm font-medium disabled:opacity-60"
        >
          {saving ? "Saving…" : "Save"}
        </button>
        {notice && (
          <span role="status" className="text-xs text-cream/70">
            ✓ {notice}
          </span>
        )}
      </div>
      {confirmingPaid && (
        <MarkPaidDialog
          guestName={booking.guestName}
          amountDue={amountToMarkPaid}
          saving={saving}
          error={error}
          onConfirm={(payment) => save(null, payment)}
          onBack={() => {
            setConfirmingPaid(false);
            setError(null);
          }}
        />
      )}
      {confirmingCancel && (
        <CancelBookingDialog
          guestName={booking.guestName}
          wasPaid={booking.status === "PAID"}
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

// Rooms-by-segment section. Each segment (just one, for the overwhelmingly common
// never-relocated booking) gets a read-only card - room, unit, dates, price - followed by
// exactly one date-editing form (BookingScheduleEditor) for the whole booking, one room-unit
// control (only when there's a single segment - see RoomUnitAssignmentEditor's own comment for
// why a relocated booking doesn't get one), and the relocate form. Previously a relocated
// booking got its dates split across two near-identical per-segment forms ("Change early/late
// arrival" / "Extend or shorten this stay", one per edge) each also carrying its own room-unit
// picker - indistinguishable at a glance, and the room picker made it look like changing a date
// could also silently reassign the room. One form, room selection nowhere near it, fixes both.
function SegmentsSection({
  booking,
  roomUnits,
  canManage,
  onSaved,
}: {
  booking: Booking;
  roomUnits: RoomUnit[];
  canManage: boolean;
  onSaved: () => void;
}) {
  const segments = booking.segments;
  const singleSegment = segments.length === 1;

  return (
    <div>
      <p className="eyebrow text-cream/50 mb-2">Rooms</p>

      <div className="space-y-2 mb-3">
        {segments.map((segment, i) => (
          <div key={segment.id} className="bg-ink border border-cream/10 rounded-xl p-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-cream">
                {segment.room.name}
                {segment.roomUnit ? ` — ${segment.roomUnit.label}` : " (unassigned)"}
              </span>
              <span className="text-cream/60">฿{Number(segment.totalPrice).toLocaleString("en-US")}</span>
            </div>
            <p className="text-xs text-cream/40 mt-1">
              {formatDateRange(segment.checkIn, segment.checkOut)}
            </p>
            <div className="flex items-center flex-wrap gap-3 mt-1">
              {i > 0 && <UndoRelocationButton bookingId={booking.id} splitDate={segment.checkIn} onSaved={onSaved} />}
              {canManage && <RepriceSegmentButton bookingId={booking.id} segmentId={segment.id} onSaved={onSaved} />}
            </div>
          </div>
        ))}
      </div>

      <BookingScheduleEditor booking={booking} onSaved={onSaved} />

      {/* Room-unit reassignment without a date change only exists as a dedicated operation
          (PUT /bookings/{id}/room-unit) for a single-segment booking - see
          RoomUnitAssignmentEditor. A relocated booking's edge segments have no equivalent: the
          schedule PATCH rejects a same-dates room-only change on a multi-segment booking as
          ambiguous (BookingWriter#resolveScheduleTarget), so swapping just the unit there means
          Undo, reassign (now single-segment), then Relocate again - more clicks, but honest
          about what this app can actually do unambiguously in one step. */}
      {singleSegment && canManage && (
        <div className="mt-2">
          <RoomUnitAssignmentEditor booking={booking} roomUnits={roomUnits} onSaved={onSaved} />
        </div>
      )}

      <RelocateForm booking={booking} canManage={canManage} onSaved={onSaved} />
    </div>
  );
}
