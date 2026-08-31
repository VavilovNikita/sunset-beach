"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ADMIN_API_URL } from "@/lib/backend";
import { extractApiError } from "@/lib/apiError";
import { dateOnlyUTC, toDateKey } from "@/lib/bookings";
import { quoteBookingSchedule, applyBookingSchedule } from "@/lib/bookingScheduleClient";
import { quoteBookingRelocation, applyBookingRelocation, undoBookingRelocation } from "@/lib/bookingRelocationClient";
import type { Booking, BookingScheduleQuote, BookingSegment, RoomUnit, AuditLogEntry } from "@/lib/types";
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
    const res = await fetch(`${ADMIN_API_URL}/bookings/${booking.id}`, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status, paymentNote: paymentNote || null }),
    });
    setSaving(false);
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setError(extractApiError(data, "Could not update booking."));
      return;
    }
    onSaved();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 bg-ink border border-cream/10 rounded-xl p-4">
      <div>
        <label className="eyebrow text-cream/60 block mb-1">Status</label>
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

// Rooms-by-segment section. A never-relocated booking (segments.length === 1, the overwhelmingly
// common case) shows the same dates+room editing the booking detail page's schedule form offers.
// A relocated booking shows each segment's own room/dates, plus:
//  - an "Undo" button per join between two segments (splitting is offered from any segment via
//    RelocateForm below, matching "переселение вызывается отсюда же");
//  - on the FIRST and LAST segment only, an EdgeSegmentScheduleEditor - PATCH .../schedule now
//    allows moving just the outer edge of a multi-segment booking (an early/late arrival on the
//    first segment, or extending/shortening the stay on the last - the most common front-desk
//    request on an already-relocated booking) without the undo/extend/re-relocate roundtrip.
//    Interior segments (segments.length >= 3) stay read-only, matching BookingWriter's
//    resolveScheduleTarget, which only ever names the first or last segment.
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

      {singleSegment ? (
        <SingleSegmentScheduleEditor booking={booking} roomUnits={roomUnits} canManage={canManage} onSaved={onSaved} />
      ) : (
        <div className="space-y-2">
          {segments.map((segment, i) => {
            const edge: "checkIn" | "checkOut" | null = i === 0 ? "checkIn" : i === segments.length - 1 ? "checkOut" : null;
            return (
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
                {i > 0 && (
                  <UndoRelocationButton bookingId={booking.id} splitDate={segment.checkIn} onSaved={onSaved} />
                )}
                {edge && (
                  <EdgeSegmentScheduleEditor
                    booking={booking}
                    segment={segment}
                    edge={edge}
                    // This panel only knows room-unit options for the booking's own mirrored
                    // type (booking.roomId, fetched scoped to that type above) - the same
                    // limitation RelocateForm already documents. That covers the first segment
                    // too whenever it's still the same room type (the common case: relocating
                    // between two units of one type), and only falls short for a genuine
                    // cross-type relocation, where this editor still offers the date change,
                    // just not a room-unit picker for it.
                    canPickUnit={segment.roomId === booking.roomId}
                    roomUnits={roomUnits}
                    canManage={canManage}
                    onSaved={onSaved}
                  />
                )}
              </div>
            );
          })}
        </div>
      )}

      <RelocateForm booking={booking} roomUnits={roomUnits} onSaved={onSaved} />
    </div>
  );
}

function EdgeSegmentScheduleEditor({
  booking,
  segment,
  edge,
  roomUnits,
  canManage,
  canPickUnit,
  onSaved,
}: {
  booking: Booking;
  segment: BookingSegment;
  // Which end of the *whole booking* this segment owns and can move - "checkIn" for the first
  // segment (early/late arrival), "checkOut" for the last (extend/shorten the stay). The other
  // date is the booking's own overall bound, not this segment's internal one, and stays fixed:
  // PATCH .../schedule only accepts a change here when exactly the named end differs from the
  // booking's current checkIn/checkOut (see BookingWriter#resolveScheduleTarget) - sending back
  // the other end unchanged is what keeps this request inside that allowed shape.
  edge: "checkIn" | "checkOut";
  roomUnits: RoomUnit[];
  canManage: boolean;
  canPickUnit: boolean;
  onSaved: () => void;
}) {
  // booking.checkIn/checkOut are already plain "YYYY-MM-DD", same as
  // segment.checkIn/checkOut - still routed through dateOnlyUTC()/toDateKey() rather than used
  // as-is, on the same principle as every other date field in this app: never trust a field's
  // current shape without normalizing it, since that's exactly the assumption that broke here
  // before (this field used to carry a legacy "T00:00:00.000Z" suffix).
  const bookingCheckInKey = toDateKey(dateOnlyUTC(booking.checkIn));
  const bookingCheckOutKey = toDateKey(dateOnlyUTC(booking.checkOut));

  const [checkIn, setCheckIn] = useState(edge === "checkIn" ? segment.checkIn : bookingCheckInKey);
  const [checkOut, setCheckOut] = useState(edge === "checkOut" ? segment.checkOut : bookingCheckOutKey);
  const [roomUnitId, setRoomUnitId] = useState<string>(segment.roomUnitId ?? "");
  const [quote, setQuote] = useState<BookingScheduleQuote | null>(null);
  const [status, setStatus] = useState<"idle" | "quoting" | "ready" | "error" | "applying">("idle");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setCheckIn(edge === "checkIn" ? segment.checkIn : bookingCheckInKey);
    setCheckOut(edge === "checkOut" ? segment.checkOut : bookingCheckOutKey);
    setRoomUnitId(segment.roomUnitId ?? "");
    setStatus("idle");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [edge, segment.checkIn, segment.checkOut, segment.roomUnitId, bookingCheckInKey, bookingCheckOutKey]);

  async function handleQuote() {
    setStatus("quoting");
    setError(null);
    const result = await quoteBookingSchedule(booking.id, { checkIn, checkOut, roomUnitId: roomUnitId || null });
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
    const result = await applyBookingSchedule(booking.id, { checkIn, checkOut, roomUnitId: roomUnitId || null });
    if (!result.ok) {
      setError(result.error);
      setStatus("error");
      return;
    }
    onSaved();
  }

  return (
    <div className="mt-2 pt-2 border-t border-cream/10 space-y-2">
      <p className="eyebrow text-cream/50">{edge === "checkIn" ? "Change early/late arrival" : "Extend or shorten this stay"}</p>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="eyebrow text-cream/60 block mb-1">Check-in</label>
          <input
            type="date"
            value={checkIn}
            disabled={edge !== "checkIn"}
            onChange={(e) => {
              setCheckIn(e.target.value);
              setStatus("idle");
            }}
            className="w-full bg-ink2 border border-cream/20 rounded-lg px-3 py-2 text-sm disabled:opacity-50"
          />
        </div>
        <div>
          <label className="eyebrow text-cream/60 block mb-1">Check-out</label>
          <input
            type="date"
            value={checkOut}
            disabled={edge !== "checkOut"}
            onChange={(e) => {
              setCheckOut(e.target.value);
              setStatus("idle");
            }}
            className="w-full bg-ink2 border border-cream/20 rounded-lg px-3 py-2 text-sm disabled:opacity-50"
          />
        </div>
      </div>
      {canManage &&
        (canPickUnit ? (
          <div>
            <label className="eyebrow text-cream/60 block mb-1">Room unit</label>
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
        ) : (
          <p className="text-xs text-cream/40">Different room type than the booking's current room — relocate to change the room.</p>
        ))}

      {status === "ready" && quote && (
        <div className="flex items-center justify-between bg-ink2 rounded-lg px-3 py-2">
          <span className="text-xs text-cream/60">
            {quote.nights} night{quote.nights === 1 ? "" : "s"}
          </span>
          <span className="font-display italic text-xl text-coral">฿{Number(quote.totalPrice).toLocaleString("en-US")}</span>
        </div>
      )}
      {status === "ready" && quote && !quote.available && <p className="text-xs text-coral">{quote.reason}</p>}
      {error && <p className="text-xs text-coral">{error}</p>}

      <div className="flex gap-2">
        {status === "ready" ? (
          <button
            type="button"
            onClick={handleApply}
            disabled={!quote?.available || status === ("applying" as typeof status)}
            className="rounded-full bg-coral hover:bg-coraldeep transition-colors px-4 py-2 text-xs font-medium disabled:opacity-60"
          >
            Confirm change
          </button>
        ) : (
          <button
            type="button"
            onClick={handleQuote}
            disabled={status === "quoting"}
            className="rounded-full border border-cream/25 hover:border-cream/50 transition-colors px-4 py-2 text-xs font-medium"
          >
            {status === "quoting" ? "Pricing…" : "Preview change"}
          </button>
        )}
      </div>
    </div>
  );
}

function SingleSegmentScheduleEditor({
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
  const segment = booking.segments[0];
  const [checkIn, setCheckIn] = useState(segment.checkIn);
  const [checkOut, setCheckOut] = useState(segment.checkOut);
  const [roomUnitId, setRoomUnitId] = useState<string>(segment.roomUnitId ?? "");
  const [quote, setQuote] = useState<BookingScheduleQuote | null>(null);
  const [status, setStatus] = useState<"idle" | "quoting" | "ready" | "error" | "applying">("idle");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setCheckIn(segment.checkIn);
    setCheckOut(segment.checkOut);
    setRoomUnitId(segment.roomUnitId ?? "");
    setStatus("idle");
  }, [segment.checkIn, segment.checkOut, segment.roomUnitId]);

  async function handleQuote() {
    setStatus("quoting");
    setError(null);
    const result = await quoteBookingSchedule(booking.id, { checkIn, checkOut, roomUnitId: roomUnitId || null });
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
    const result = await applyBookingSchedule(booking.id, { checkIn, checkOut, roomUnitId: roomUnitId || null });
    if (!result.ok) {
      setError(result.error);
      setStatus("error");
      return;
    }
    onSaved();
  }

  return (
    <div className="bg-ink border border-cream/10 rounded-xl p-4 space-y-3">
      <p className="text-sm text-cream">{segment.room.name}</p>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="eyebrow text-cream/60 block mb-1">Check-in</label>
          <input
            type="date"
            value={checkIn}
            onChange={(e) => {
              setCheckIn(e.target.value);
              setStatus("idle");
            }}
            className="w-full bg-ink2 border border-cream/20 rounded-lg px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="eyebrow text-cream/60 block mb-1">Check-out</label>
          <input
            type="date"
            value={checkOut}
            onChange={(e) => {
              setCheckOut(e.target.value);
              setStatus("idle");
            }}
            className="w-full bg-ink2 border border-cream/20 rounded-lg px-3 py-2 text-sm"
          />
        </div>
      </div>
      {canManage && (
        <div>
          <label className="eyebrow text-cream/60 block mb-1">Room unit</label>
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

      {status === "ready" && quote && (
        <div className="flex items-center justify-between bg-ink2 rounded-lg px-3 py-2">
          <span className="text-xs text-cream/60">
            {quote.nights} night{quote.nights === 1 ? "" : "s"}
          </span>
          <span className="font-display italic text-xl text-coral">฿{Number(quote.totalPrice).toLocaleString("en-US")}</span>
        </div>
      )}
      {status === "ready" && quote && !quote.available && <p className="text-xs text-coral">{quote.reason}</p>}
      {error && <p className="text-xs text-coral">{error}</p>}

      <div className="flex gap-2">
        {status === "ready" ? (
          <button
            type="button"
            onClick={handleApply}
            disabled={!quote?.available || status === ("applying" as typeof status)}
            className="rounded-full bg-coral hover:bg-coraldeep transition-colors px-4 py-2 text-xs font-medium disabled:opacity-60"
          >
            Confirm change
          </button>
        ) : (
          <button
            type="button"
            onClick={handleQuote}
            disabled={status === "quoting"}
            className="rounded-full border border-cream/25 hover:border-cream/50 transition-colors px-4 py-2 text-xs font-medium"
          >
            {status === "quoting" ? "Pricing…" : "Preview change"}
          </button>
        )}
      </div>
    </div>
  );
}

function RelocateForm({ booking, roomUnits, onSaved }: { booking: Booking; roomUnits: RoomUnit[]; onSaved: () => void }) {
  const [open, setOpen] = useState(false);
  const [effectiveDate, setEffectiveDate] = useState("");
  const [roomUnitId, setRoomUnitId] = useState("");
  const [quote, setQuote] = useState<BookingScheduleQuote | null>(null);
  const [status, setStatus] = useState<"idle" | "quoting" | "ready" | "error" | "applying">("idle");
  const [error, setError] = useState<string | null>(null);

  // This panel only offers relocating within the *same room type* (the room-unit picker is
  // scoped to this booking's own roomUnits list, already fetched for that type) - moving to a
  // different room type is possible via the API (RelocationInput.roomId) but has no picker here
  // yet; the guest-facing room type wouldn't be known without fetching every room type's units.
  const roomId = booking.roomId;

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
        onClick={() => setOpen(true)}
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

      {status === "ready" && quote && (
        <div className="flex items-center justify-between bg-ink2 rounded-lg px-3 py-2">
          <span className="text-xs text-cream/60">New total</span>
          <span className="font-display italic text-xl text-coral">฿{Number(quote.totalPrice).toLocaleString("en-US")}</span>
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
