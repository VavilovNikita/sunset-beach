"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ADMIN_API_URL } from "@/lib/backend";
import { adminRequest, adminJsonInit } from "@/lib/adminFetch";
import { quoteBookingRelocation, applyBookingRelocation, undoBookingRelocation } from "@/lib/bookingRelocationClient";
import RoomChargeDebtBadge from "@/components/admin/RoomChargeDebtBadge";
import { BookingScheduleEditor, RoomUnitAssignmentEditor } from "@/components/admin/BookingScheduleEditor";
import type { Booking, BookingScheduleQuote, Room, RoomUnit, AuditLogEntry } from "@/lib/types";
import type { BookingPosOrder, Folio } from "@/lib/posTypes";

const STATUSES = ["NEW", "CONFIRMED", "PAID", "CANCELLED"] as const;

// Slide-in panel opened by clicking a bar on the booking calendar grid - deliberately a fixed-
// width side panel, not a full-screen modal, so reception can still see the grid (neighbouring
// dates/rooms) while working the booking. All edits go through the same endpoints the booking
// detail page and the grid's own drag/resize already use - see lib/bookingScheduleClient.ts and
// lib/bookingRelocationClient.ts - there is no booking-panel-specific write endpoint.
//
// Guest name/email/phone are shown but not editable here: no PATCH exists for those fields on
// any booking-editing surface in this app (only status/paymentNote, schedule, and now
// relocation do), so offering an edit control for them would imply a capability this backend
// doesn't have.
export default function BookingCardPanel({
  bookingId,
  canManage,
  onClose,
}: {
  bookingId: string;
  // MANAGER+ - same gate GET /room-units and GET /audit-log already use elsewhere (see the
  // booking detail page's canListUnits). A CASHIER still gets the panel, just without the
  // room-unit picker (relocate/schedule can still target "no unit yet") or the history list.
  canManage: boolean;
  onClose: () => void;
}) {
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
        setRoomUnits(units.filter((u: RoomUnit) => u.isActive));
        setAuditLog(audit.items ?? []);
      }
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
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
              <p className="text-sm text-cream/50">{booking.guestEmail || "No email on file"}</p>
              <p className="text-sm text-cream/50">{booking.guestPhone || "No phone on file"}</p>
              <Link
                href={`/admin/bookings/${booking.id}`}
                className="inline-block mt-2 text-xs text-sea hover:text-coral transition-colors underline underline-offset-4"
              >
                Open full page
              </Link>
            </div>

            <StatusAndNoteEditor booking={booking} folio={folio} onSaved={refetch} />

            <SegmentsSection
              booking={booking}
              roomUnits={roomUnits}
              canManage={canManage}
              onSaved={refetch}
            />

            <div>
              <p className="eyebrow text-cream/50 mb-2">Folio</p>
              {folio ? (
                <div className="bg-ink border border-cream/10 rounded-xl p-4 text-sm space-y-1">
                  <div className="flex items-center justify-between text-cream/60">
                    <span>Room</span>
                    <span>฿{Number(folio.roomTotal).toLocaleString("en-US")}</span>
                  </div>
                  <div className="flex items-center justify-between text-cream/60">
                    <span>Room charges ({folio.roomChargeCount})</span>
                    <span>฿{Number(folio.roomChargesTotal).toLocaleString("en-US")}</span>
                  </div>
                  <div className="flex items-center justify-between pt-2 mt-2 border-t border-cream/10">
                    <span className="font-display italic text-cream">Total due</span>
                    <span className="font-display italic text-2xl text-coral">
                      ฿{Number(folio.folioTotal).toLocaleString("en-US")}
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
                        <span>{po.paidAt.slice(0, 10)}</span>
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
                        <p className="text-cream/70">{entry.summary}</p>
                        <p className="text-cream/40 mt-1">
                          {entry.createdAt.slice(0, 19).replace("T", " ")} UTC · {entry.actorEmail}
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
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setStatus(booking.status);
    setPaymentNote(booking.paymentNote ?? "");
  }, [booking.status, booking.paymentNote]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const result = await adminRequest(
      `/bookings/${booking.id}`,
      adminJsonInit("PATCH", { status, paymentNote: paymentNote || null }),
      "Could not update booking."
    );
    setSaving(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    onSaved();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 bg-ink border border-cream/10 rounded-xl p-4">
      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="eyebrow text-cream/60">Status</label>
          {booking.status === "PAID" && folio && (
            <RoomChargeDebtBadge roomChargesTotal={folio.roomChargesTotal} roomChargeCount={folio.roomChargeCount} />
          )}
        </div>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as Booking["status"])}
          className="w-full bg-ink2 border border-cream/20 rounded-lg px-3 py-2 text-sm"
        >
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>
      {status === "PAID" && folio && folio.roomChargeCount > 0 && (
        <p className="text-xs text-coral bg-coral/10 border border-coral/30 rounded-lg px-3 py-2">
          Total due including room charges is ฿{Number(folio.folioTotal).toLocaleString("en-US")} — confirm that&rsquo;s
          what was collected.
        </p>
      )}
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
      {error && <p className="text-xs text-coral">{error}</p>}
      <button
        type="submit"
        disabled={saving}
        className="rounded-full bg-coral hover:bg-coraldeep transition-colors px-5 py-2 text-sm font-medium disabled:opacity-60"
      >
        {saving ? "Saving…" : "Save"}
      </button>
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
              {segment.checkIn} → {segment.checkOut}
            </p>
            {i > 0 && <UndoRelocationButton bookingId={booking.id} splitDate={segment.checkIn} onSaved={onSaved} />}
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

// Relocating to a different room *type* is a normal front-desk operation (upgrade, downgrade,
// or moving someone out of a broken room) — the backend has never restricted `relocate` to the
// booking's current type (RelocationInput.roomId can name any room), that restriction was only
// ever a gap in this picker, which used to just reuse the booking's own already-fetched
// roomUnits and never offered a type choice. Fetches its own room list and, per selected type,
// its own room-unit list, independently of the parent's roomUnits (still scoped to the booking's
// *current* type, for SingleSegmentScheduleEditor/EdgeSegmentScheduleEditor which can only ever
// change the room-unit within the segment's existing type — schedule changes never carry a
// roomId, see BookingWriter#resolveScheduleTarget).
function RelocateForm({ booking, canManage, onSaved }: { booking: Booking; canManage: boolean; onSaved: () => void }) {
  const [open, setOpen] = useState(false);
  const [effectiveDate, setEffectiveDate] = useState("");
  const [rooms, setRooms] = useState<Room[]>([]);
  const [roomId, setRoomId] = useState(booking.roomId);
  const [roomUnits, setRoomUnits] = useState<RoomUnit[]>([]);
  const [roomUnitId, setRoomUnitId] = useState("");
  const [quote, setQuote] = useState<BookingScheduleQuote | null>(null);
  const [status, setStatus] = useState<"idle" | "quoting" | "ready" | "error" | "applying">("idle");
  const [error, setError] = useState<string | null>(null);

  // Fetched once per time the form is opened, not on every render — the room list barely
  // changes mid-session, and re-fetching on every keystroke elsewhere in the panel would be
  // wasteful. Types with zero active units are left out: nothing to relocate into.
  useEffect(() => {
    if (!open) return;
    fetch(`${ADMIN_API_URL}/rooms`, { credentials: "include" })
      .then((r) => (r.ok ? r.json() : []))
      .then((data: Room[]) => setRooms(data.filter((r) => r.activeUnitCount > 0).sort((a, b) => a.name.localeCompare(b.name))))
      .catch(() => setRooms([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Re-fetched whenever the target type changes — units belong to one type, so the previous
  // type's list is meaningless once roomId moves. Still MANAGER+-gated like every other
  // room-unit picker in this panel; a CASHIER can relocate but not browse/pick physical units,
  // same restriction the same-type picker already had (relocate can still target "no unit yet").
  useEffect(() => {
    if (!open || !canManage) {
      setRoomUnits([]);
      return;
    }
    fetch(`${ADMIN_API_URL}/room-units?roomId=${roomId}`, { credentials: "include" })
      .then((r) => (r.ok ? r.json() : []))
      .then((units: RoomUnit[]) => setRoomUnits(units.filter((u: RoomUnit) => u.isActive)))
      .catch(() => setRoomUnits([]));
  }, [open, canManage, roomId]);

  const selectedRoomName = rooms.find((r) => r.id === roomId)?.name ?? booking.room.name;
  const isCrossType = roomId !== booking.roomId;
  const priceDelta = quote ? Number(quote.totalPrice) - Number(booking.totalPrice) : 0;

  function openForm() {
    setRoomId(booking.roomId);
    setOpen(true);
  }

  function handleRoomChange(nextRoomId: string) {
    setRoomId(nextRoomId);
    setRoomUnitId(""); // the previous unit belongs to the old type, never valid for the new one
    setQuote(null);
    setStatus("idle");
  }

  async function handleQuote() {
    if (!effectiveDate) return;
    setStatus("quoting");
    setError(null);
    const result = await quoteBookingRelocation(booking.id, { effectiveDate, roomId, roomUnitId: roomUnitId || null });
    if (!result.ok) {
      setError(result.error);
      setStatus("error");
      return;
    }
    setQuote(result.quote);
    setStatus("ready");
  }

  async function handleApply() {
    setStatus("applying");
    const result = await applyBookingRelocation(booking.id, { effectiveDate, roomId, roomUnitId: roomUnitId || null });
    if (!result.ok) {
      setError(result.error);
      setStatus("error");
      return;
    }
    setOpen(false);
    setEffectiveDate("");
    setRoomUnitId("");
    setQuote(null);
    setStatus("idle");
    onSaved();
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={openForm}
        className="mt-3 text-xs text-sea hover:text-coral transition-colors underline underline-offset-4"
      >
        Relocate to another room
      </button>
    );
  }

  return (
    <div className="mt-3 bg-ink border border-cream/10 rounded-xl p-4 space-y-3">
      <p className="eyebrow text-cream/50">Relocate from a date</p>
      <div>
        <label className="eyebrow text-cream/60 block mb-1">Effective date</label>
        <input
          type="date"
          min={booking.segments[0].checkIn}
          max={booking.segments[booking.segments.length - 1].checkOut}
          value={effectiveDate}
          onChange={(e) => {
            setEffectiveDate(e.target.value);
            setStatus("idle");
          }}
          className="w-full bg-ink2 border border-cream/20 rounded-lg px-3 py-2 text-sm"
        />
      </div>
      <div>
        <label className="eyebrow text-cream/60 block mb-1">New room type</label>
        <select
          value={roomId}
          onChange={(e) => handleRoomChange(e.target.value)}
          className="w-full bg-ink2 border border-cream/20 rounded-lg px-3 py-2 text-sm"
        >
          {/* The booking's current type is always offered even if it has since run out of
              active units elsewhere (rooms list filters those out) - staying in the same type
              (moving to a different physical room within it) must never become unpickable. */}
          {!rooms.some((r) => r.id === booking.roomId) && <option value={booking.roomId}>{booking.room.name}</option>}
          {rooms.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </select>
      </div>
      {canManage && (
        <div>
          <label className="eyebrow text-cream/60 block mb-1">New room unit</label>
          <select
            value={roomUnitId}
            onChange={(e) => {
              setRoomUnitId(e.target.value);
              setStatus("idle");
            }}
            className="w-full bg-ink2 border border-cream/20 rounded-lg px-3 py-2 text-sm"
          >
            <option value="">Unassigned</option>
            {roomUnits.map((u) => (
              <option key={u.id} value={u.id}>
                {u.label}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Same reasoning as BookingScheduleEditor: a rejected quote's totalPrice/nights are 0, not
          absent - showing them next to the rejection reason would read as "the total is now
          ฿0", not "nothing was priced". Only the target type and reason belong on screen here
          when available is false. */}
      {status === "ready" && quote && quote.available && (
        <div className="bg-ink2 rounded-lg px-3 py-2 space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-xs text-cream/60">New room type</span>
            <span className={`text-sm ${isCrossType ? "text-coral font-medium" : "text-cream"}`}>{selectedRoomName}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-cream/60">New booking total</span>
            <span className="font-display italic text-xl text-coral">฿{Number(quote.totalPrice).toLocaleString("en-US")}</span>
          </div>
          {/* Same-type relocation (moving physical room, not room type) always prices out to a
              zero difference - rate plans are per room type, not per unit, so two units of the
              same type on the same dates always cost the same. A cross-type move is exactly the
              operation that changes this number, so it's called out explicitly rather than left
              for reception to notice by comparing two totals themselves. */}
          <div className="flex items-center justify-between pt-1.5 border-t border-cream/10">
            <span className="text-xs text-cream/60">Change vs. current total</span>
            <span className={`text-sm font-medium ${priceDelta === 0 ? "text-cream/50" : priceDelta > 0 ? "text-coral" : "text-sea"}`}>
              {priceDelta === 0 ? "No change" : `${priceDelta > 0 ? "+" : "−"}฿${Math.abs(priceDelta).toLocaleString("en-US")}`}
            </span>
          </div>
        </div>
      )}
      {status === "ready" && quote && !quote.available && <p className="text-xs text-coral">{quote.reason}</p>}
      {error && <p className="text-xs text-coral">{error}</p>}

      <div className="flex gap-2 flex-wrap">
        {status === "ready" ? (
          <button
            type="button"
            onClick={handleApply}
            disabled={!quote?.available || status === ("applying" as typeof status)}
            className="rounded-full bg-coral hover:bg-coraldeep transition-colors px-4 py-2 text-xs font-medium disabled:opacity-60"
          >
            Confirm relocation
          </button>
        ) : (
          <button
            type="button"
            onClick={handleQuote}
            disabled={!effectiveDate || status === "quoting"}
            className="rounded-full border border-cream/25 hover:border-cream/50 transition-colors px-4 py-2 text-xs font-medium disabled:opacity-40"
          >
            {status === "quoting" ? "Pricing…" : "Preview relocation"}
          </button>
        )}
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-xs text-cream/50 hover:text-cream transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

function UndoRelocationButton({ bookingId, splitDate, onSaved }: { bookingId: string; splitDate: string; onSaved: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleUndo() {
    if (!window.confirm("Undo this relocation? The earlier room will cover the full merged range again.")) return;
    setBusy(true);
    setError(null);
    const result = await undoBookingRelocation(bookingId, { splitDate });
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    onSaved();
  }

  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={handleUndo}
        disabled={busy}
        className="text-xs text-sea hover:text-coral transition-colors underline underline-offset-4 disabled:opacity-60"
      >
        {busy ? "Undoing…" : "Undo this relocation"}
      </button>
      {error && <p className="text-xs text-coral mt-1">{error}</p>}
    </div>
  );
}
