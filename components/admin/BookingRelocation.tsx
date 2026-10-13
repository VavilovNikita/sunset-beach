"use client";

import { useEffect, useState } from "react";
import { ADMIN_API_URL } from "@/lib/backend";
import { quoteBookingRelocation, applyBookingRelocation, undoBookingRelocation } from "@/lib/bookingRelocationClient";
import { quoteBookingReprice, applyBookingReprice } from "@/lib/bookingRepriceClient";
import { defaultRelocationDate } from "@/lib/bookingRelocationDefaults";
import { hotelDateKey } from "@/lib/hotelDate";
import { sortRoomsByName, sortUnitsByLabel } from "@/lib/sortRooms";
import ConfirmActionDialog from "@/components/admin/ConfirmActionDialog";
import type { Booking, BookingScheduleQuote, Room, RoomUnit } from "@/lib/types";

// The room-moving controls of a booking: relocate from a date, undo a relocation, reprice a segment.
// One copy, used by the calendar's side panel (BookingCardPanel.tsx) and the full booking page
// (BookingRoomsCard.tsx) - the page used to have neither relocation nor a way to reprice, so the same
// stay could be moved from the calendar but not from its own page.

// Relocating to a different room *type* is a normal front-desk operation (upgrade, downgrade,
// or moving someone out of a broken room) — the backend has never restricted `relocate` to the
// booking's current type (RelocationInput.roomId can name any room), that restriction was only
// ever a gap in this picker, which used to just reuse the booking's own already-fetched
// roomUnits and never offered a type choice. Fetches its own room list and, per selected type,
// its own room-unit list, independently of the parent's roomUnits (still scoped to the booking's
// *current* type, for SingleSegmentScheduleEditor/EdgeSegmentScheduleEditor which can only ever
// change the room-unit within the segment's existing type — schedule changes never carry a
// roomId, see BookingWriter#resolveScheduleTarget).
export function RelocateForm({ booking, canManage, onSaved }: { booking: Booking; canManage: boolean; onSaved: () => void }) {
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
      .then((data: Room[]) => setRooms(sortRoomsByName(data.filter((r) => r.activeUnitCount > 0))))
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
      .then((units: RoomUnit[]) => setRoomUnits(sortUnitsByLabel(units.filter((u: RoomUnit) => u.isActive))))
      .catch(() => setRoomUnits([]));
  }, [open, canManage, roomId]);

  const selectedRoomName = rooms.find((r) => r.id === roomId)?.name ?? booking.room.name;
  const isCrossType = roomId !== booking.roomId;
  const priceDelta = quote ? Number(quote.totalPrice) - Number(booking.totalPrice) : 0;

  function openForm() {
    setRoomId(booking.roomId);
    // Today when the move can start today, else the nearest day the stay allows - an empty date left
    // the preview button disabled with no hint why.
    setEffectiveDate(defaultRelocationDate(hotelDateKey(new Date()), booking.segments[0].checkIn, booking.segments[booking.segments.length - 1].checkOut));
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

export function UndoRelocationButton({ bookingId, splitDate, onSaved }: { bookingId: string; splitDate: string; onSaved: () => void }) {
  const [asking, setAsking] = useState(false);

  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={() => setAsking(true)}
        className="text-xs text-sea hover:text-coral transition-colors underline underline-offset-4"
      >
        Undo this relocation
      </button>
      {asking && (
        <ConfirmActionDialog
          eyebrow="Relocation"
          title="Undo this relocation?"
          confirmLabel="Undo relocation"
          busyLabel="Undoing…"
          action={async () => {
            const result = await undoBookingRelocation(bookingId, { splitDate });
            return result.ok ? null : result.error;
          }}
          onDone={() => {
            setAsking(false);
            onSaved();
          }}
          onBack={() => setAsking(false)}
        >
          <p className="text-sm text-cream/60">The earlier room will cover the full merged range again.</p>
        </ConfirmActionDialog>
      )}
    </div>
  );
}

// The one explicit, deliberate way to move an already-agreed price forward - see
// BookingWriter's class javadoc ("Nightly price snapshots") for why extending/shrinking/
// relocating a stay never does this on its own. MANAGER+ only (canManage, same gate the caller
// already applies), since this overrides a price rather than administering a guest's own
// request. Quote-then-confirm, same pattern as RelocateForm - a price change is never applied
// without the manager seeing the before/after total first.
export function RepriceSegmentButton({ bookingId, segmentId, onSaved }: { bookingId: string; segmentId: string; onSaved: () => void }) {
  const [open, setOpen] = useState(false);
  const [quote, setQuote] = useState<{ oldTotalPrice: string; newTotalPrice: string; nightsRepriced: number } | null>(null);
  const [status, setStatus] = useState<"idle" | "quoting" | "ready" | "error" | "applying">("idle");
  const [error, setError] = useState<string | null>(null);

  async function handleQuote() {
    setStatus("quoting");
    setError(null);
    const result = await quoteBookingReprice(bookingId, { segmentId });
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
    const result = await applyBookingReprice(bookingId, { segmentId });
    if (!result.ok) {
      setError(result.error);
      setStatus("error");
      return;
    }
    setOpen(false);
    setQuote(null);
    setStatus("idle");
    onSaved();
  }

  function close() {
    setOpen(false);
    setQuote(null);
    setStatus("idle");
    setError(null);
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-xs text-sea hover:text-coral transition-colors underline underline-offset-4"
      >
        Reprice to current rates
      </button>
    );
  }

  return (
    <div className="mt-2 bg-ink2 border border-cream/10 rounded-lg p-3 space-y-2 text-xs w-full">
      {status !== "ready" ? (
        <button
          type="button"
          onClick={handleQuote}
          disabled={status === "quoting"}
          className="rounded-full border border-cream/25 hover:border-cream/50 transition-colors px-3 py-1.5 font-medium disabled:opacity-40"
        >
          {status === "quoting" ? "Checking…" : "Preview reprice"}
        </button>
      ) : (
        <>
          {quote!.nightsRepriced === 0 ? (
            <p className="text-cream/40">Nothing left to reprice - this segment is entirely in the past.</p>
          ) : (
            <p className="text-cream/70">
              {quote!.nightsRepriced} night{quote!.nightsRepriced === 1 ? "" : "s"}: ฿
              {Number(quote!.oldTotalPrice).toLocaleString("en-US")} → ฿{Number(quote!.newTotalPrice).toLocaleString("en-US")}
            </p>
          )}
          <button
            type="button"
            onClick={handleApply}
            disabled={quote!.nightsRepriced === 0 || status === ("applying" as typeof status)}
            className="rounded-full bg-coral hover:bg-coraldeep transition-colors px-3 py-1.5 font-medium disabled:opacity-60"
          >
            {status === ("applying" as typeof status) ? "Applying…" : "Confirm reprice"}
          </button>
        </>
      )}
      {error && <p className="text-coral">{error}</p>}
      <button type="button" onClick={close} className="block text-cream/50 hover:text-cream transition-colors">
        Cancel
      </button>
    </div>
  );
}
