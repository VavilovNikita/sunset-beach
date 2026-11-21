"use client";

import { useEffect, useState } from "react";
import { ADMIN_API_URL } from "@/lib/backend";
import { quoteBookingRelocation, applyBookingRelocation, undoBookingRelocation } from "@/lib/bookingRelocationClient";
import { quoteBookingReprice, applyBookingReprice } from "@/lib/bookingRepriceClient";
import { defaultRelocationDate, relocationDateBounds } from "@/lib/bookingRelocationDefaults";
import { describeDifference, figuresFor, rateChoices, rateModeToSend, relocationNeedsUnit } from "@/lib/bookingRelocation";
import { hotelDateKey } from "@/lib/hotelDate";
import { sortRoomsByName, sortUnitsByLabel } from "@/lib/sortRooms";
import { useCloseOnBrowserBack } from "@/lib/useCloseOnBrowserBack";
import ConfirmActionDialog from "@/components/admin/ConfirmActionDialog";
import PaidPriceNotice from "@/components/admin/PaidPriceNotice";
import type { Booking, RelocationQuote, RelocationRateMode, RepriceQuote, Room, RoomUnit } from "@/lib/types";
import { formatBaht } from "@/lib/money";
import { fetchAvailability } from "@/lib/availabilityClient";
import { busyUnits, monthsOfRange, movedRange } from "@/lib/relocationUnits";

// The room-moving controls of a booking: relocate from a date, undo a relocation, reprice a segment.
// One copy, used by the calendar's side panel (BookingCardPanel.tsx), the full booking page
// (BookingRoomsCard.tsx) and - as a dialog - by a bar dropped on another room in the calendar
// (RelocationDialog below). The page used to have neither relocation nor a way to reprice, so the
// same stay could be moved from the calendar but not from its own page.

// Relocating to a different room *type* is a normal front-desk operation (upgrade, downgrade,
// or moving someone out of a broken room) — the backend has never restricted `relocate` to the
// booking's current type (RelocationInput.roomId can name any room), that restriction was only
// ever a gap in this picker, which used to just reuse the booking's own already-fetched
// roomUnits and never offered a type choice. Fetches its own room list and, per selected type,
// its own room-unit list, independently of the parent's roomUnits (still scoped to the booking's
// *current* type, for SingleSegmentScheduleEditor/EdgeSegmentScheduleEditor which can only ever
// change the room-unit within the segment's existing type — schedule changes never carry a
// roomId, see BookingWriter#resolveScheduleTarget).
//
// A move may start on any night of the stay, the first one included (a guest arriving today): the
// server then changes the whole segment's room instead of splitting it. Every figure on screen
// comes from the server's quote (lib/bookingRelocation.ts only picks and formats) - this form
// never subtracts one price from another.

/** A room (and unit) already chosen elsewhere - the calendar drop - so the pickers are not shown. */
export type RelocationPreset = { effectiveDate: string; roomId: string; roomUnitId: string; roomUnitLabel: string };

export function RelocationPanel({
  booking,
  canManage,
  preset,
  heading,
  onClose,
  onSaved,
}: {
  booking: Booking;
  canManage: boolean;
  preset?: RelocationPreset;
  /** The title inside the frame (the dialog names the guest); the inline form keeps "Relocate from a date". */
  heading?: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const stayStart = booking.segments[0].checkIn;
  const stayEnd = booking.segments[booking.segments.length - 1].checkOut;
  const todayKey = hotelDateKey(new Date());
  // A CASHIER cannot move a guest from a day in the past (the server answers 403); a manager can.
  const bounds = relocationDateBounds(todayKey, stayStart, stayEnd, canManage);

  const [effectiveDate, setEffectiveDate] = useState(preset?.effectiveDate ?? defaultRelocationDate(todayKey, stayStart, stayEnd));
  const [rooms, setRooms] = useState<Room[]>([]);
  const [roomId, setRoomId] = useState(preset?.roomId ?? booking.roomId);
  const [roomUnits, setRoomUnits] = useState<RoomUnit[]>([]);
  const [roomUnitId, setRoomUnitId] = useState(preset?.roomUnitId ?? "");
  const [busy, setBusy] = useState<Map<string, string>>(new Map());
  const [quote, setQuote] = useState<RelocationQuote | null>(null);
  const [pickedMode, setPickedMode] = useState<RelocationRateMode | null>(null);
  const [status, setStatus] = useState<"idle" | "quoting" | "ready" | "error" | "applying">("idle");
  const [error, setError] = useState<string | null>(null);

  // Fetched once per time the form is opened, not on every render — the room list barely
  // changes mid-session, and re-fetching on every keystroke elsewhere in the panel would be
  // wasteful. Types with zero active units are left out: nothing to relocate into.
  useEffect(() => {
    if (preset) return; // the target was chosen by the drop
    fetch(`${ADMIN_API_URL}/rooms`, { credentials: "include" })
      .then((r) => (r.ok ? r.json() : []))
      .then((data: Room[]) => setRooms(sortRoomsByName(data.filter((r) => r.activeUnitCount > 0))))
      .catch(() => setRooms([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-fetched whenever the target type changes — units belong to one type, so the previous
  // type's list is meaningless once roomId moves. Everyone who can relocate (CASHIER+) can list
  // room units (GET /room-units is open from WAITER), so everyone picks one: a cashier once sent an
  // in-house guest to "no room assigned" because the picker was hidden from them.
  useEffect(() => {
    if (preset) {
      setRoomUnits([]);
      return;
    }
    fetch(`${ADMIN_API_URL}/room-units?roomId=${roomId}`, { credentials: "include" })
      .then((r) => (r.ok ? r.json() : []))
      .then((units: RoomUnit[]) => setRoomUnits(sortUnitsByLabel(units.filter((u: RoomUnit) => u.isActive))))
      .catch(() => setRoomUnits([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId]);

  // Which rooms are taken on the nights that would move, from the server's availability (the same data the calendar
  // reads). Only a hint: a failed read marks nothing, and the server still decides when the move is applied.
  const holderSegment = booking.segments.find((s) => s.checkIn <= effectiveDate && effectiveDate < s.checkOut);
  const currentUnitId = holderSegment?.roomUnitId ?? null;
  useEffect(() => {
    if (preset || !effectiveDate) {
      setBusy(new Map());
      return;
    }
    let cancelled = false;
    const range = movedRange(booking.segments, effectiveDate);
    Promise.all(monthsOfRange(range.from, range.toExclusive).map((month) => fetchAvailability(roomId, month))).then((results) => {
      if (cancelled) return;
      const days = results.flatMap((r) => (r.ok ? r.days : []));
      setBusy(busyUnits(days, range.from, range.toExclusive, booking.id));
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId, effectiveDate]);

  // A room chosen earlier that turns out taken for the new dates is dropped from the choice, not sent to be refused.
  useEffect(() => {
    if (roomUnitId && busy.has(roomUnitId)) setRoomUnitId("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busy]);

  // A guest in the house moved from today must be given a room - the server refuses it otherwise.
  const unitRequired = relocationNeedsUnit(booking.occupancyStatus, effectiveDate, todayKey);
  const missingUnit = unitRequired && !roomUnitId;

  const selectedRoomName = rooms.find((r) => r.id === roomId)?.name ?? (roomId === booking.roomId ? booking.room.name : null);

  function handleRoomChange(nextRoomId: string) {
    setRoomId(nextRoomId);
    setRoomUnitId(""); // the previous unit belongs to the old type, never valid for the new one
    invalidate();
  }

  function invalidate() {
    setQuote(null);
    setPickedMode(null);
    setError(null);
    setStatus("idle");
  }

  async function handleQuote(mode?: RelocationRateMode) {
    if (!effectiveDate) return;
    setStatus("quoting");
    setError(null);
    const result = await quoteBookingRelocation(booking.id, { effectiveDate, roomId, roomUnitId: roomUnitId || null, ...(mode ? { rateMode: mode } : {}) });
    if (!result.ok) {
      setError(result.error);
      setStatus("error");
      return;
    }
    setQuote(result.quote);
    setStatus("ready");
  }

  // The server words what a price change does to a PAID booking for the rate it was asked about, so a
  // different choice asks again instead of reusing the warning of the other one.
  async function handlePickMode(mode: RelocationRateMode) {
    setPickedMode(mode);
    if (quote && quote.rateMode !== mode) await handleQuote(mode);
  }

  async function handleApply() {
    if (!quote) return;
    setStatus("applying");
    setError(null);
    const result = await applyBookingRelocation(booking.id, {
      effectiveDate,
      roomId,
      roomUnitId: roomUnitId || null,
      rateMode: rateModeToSend(quote, pickedMode),
    });
    if (!result.ok) {
      // The form stays as it is, with the preview, so the desk can fix the cause and try again.
      setError(result.error);
      setStatus("ready");
      return;
    }
    onSaved();
    onClose();
  }

  const choices = quote ? rateChoices(quote) : [];
  const modeToSend = quote ? rateModeToSend(quote, pickedMode) : undefined;
  const figures = quote ? figuresFor(quote, modeToSend) : null;
  const change = figures ? describeDifference(figures.difference) : null;

  return (
    <div className="bg-ink border border-cream/10 rounded-xl p-4 space-y-3">
      {heading ? <p className="eyebrow text-coral">{heading}</p> : <p className="eyebrow text-cream/50">Relocate from a date</p>}
      <div>
        <label className="eyebrow text-cream/60 block mb-1">Effective date</label>
        <input
          type="date"
          min={bounds.min}
          max={bounds.max}
          value={effectiveDate}
          onChange={(e) => {
            setEffectiveDate(e.target.value);
            invalidate();
          }}
          className="w-full bg-ink2 border border-cream/20 rounded-lg px-3 py-2 text-sm"
        />
        <p className="text-[11px] text-cream/40 mt-1">
          The first night in the new room. Nights before it stay where the guest slept{canManage ? "" : "; a move can start today at the earliest"}.
        </p>
      </div>
      {preset ? (
        <div className="bg-ink2 rounded-lg px-3 py-2 text-sm">
          <span className="text-xs text-cream/60">New room </span>
          <span className="text-cream">{preset.roomUnitLabel}</span>
        </div>
      ) : (
        <>
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
          <div>
            <label className="eyebrow text-cream/60 block mb-1">New room unit</label>
            <select
              value={roomUnitId}
              onChange={(e) => {
                setRoomUnitId(e.target.value);
                invalidate();
              }}
              className="w-full bg-ink2 border border-cream/20 rounded-lg px-3 py-2 text-sm"
            >
              <option value="">{unitRequired ? "Choose a room…" : "Unassigned"}</option>
              {roomUnits
                .filter((u) => u.id !== currentUnitId)
                .map((u) => {
                  const taken = busy.get(u.id);
                  return (
                    <option key={u.id} value={u.id} disabled={taken !== undefined}>
                      {taken !== undefined ? `${u.label} — ${taken}` : u.label}
                    </option>
                  );
                })}
            </select>
            {unitRequired && <p className="text-[11px] text-cream/40 mt-1">A guest who is in the house needs a room.</p>}
          </div>
        </>
      )}

      {/* Same reasoning as BookingScheduleEditor: a rejected quote's totalPrice/nights are not a
          price - showing them next to the rejection reason would read as "the total is now ฿0",
          not "nothing was priced". Only the reason belongs on screen when available is false. */}
      {status !== "idle" && status !== "quoting" && quote && quote.available && figures && change && (
        <div className="bg-ink2 rounded-lg px-3 py-2 space-y-2">
          {quote.wholeSegment && (
            <p className="text-[11px] text-cream/50">Starts on the first night of this part of the stay, so all of it moves to the new room.</p>
          )}
          {quote.sameRoomType ? (
            <p className="text-xs text-cream/70">Same room type – price unchanged</p>
          ) : (
            <fieldset className="space-y-1.5">
              <legend className="text-xs text-cream/60 mb-1">Price of the moved {quote.nights === 1 ? "night" : `${quote.nights} nights`}{selectedRoomName ? ` in ${selectedRoomName}` : ""}</legend>
              {choices.filter((c) => c.allowed).map((c) => {
                const text = describeDifference(c.difference);
                const checked = modeToSend === c.mode;
                return (
                  <label
                    key={c.mode}
                    className={`flex items-start gap-2 rounded-lg border px-3 py-2 ${c.allowed ? "cursor-pointer" : "opacity-60"} ${
                      checked ? "border-coral/60 bg-coral/5" : "border-cream/10"
                    }`}
                  >
                    <input
                      type="radio"
                      name="relocation-rate"
                      className="mt-1"
                      checked={checked}
                      disabled={!c.allowed}
                      onChange={() => void handlePickMode(c.mode)}
                    />
                    <span className="flex-1 text-sm">
                      <span className="block text-cream">{c.mode === "NEW_RATE" ? "Apply new rate" : "Keep original rate"}</span>
                      <span className="block text-[11px] text-cream/50">
                        {c.mode === "NEW_RATE"
                          ? "Paid upgrade or downgrade: the new room's price from today."
                          : c.allowed
                            ? "Complimentary upgrade or a move the hotel caused: the nights keep their agreed price."
                            : ""}
                      </span>
                    </span>
                    <span className="text-right text-sm">
                      <span className="block font-display italic text-coral">{formatBaht(c.total)}</span>
                      <span className={`block text-[11px] ${text.tone === "up" ? "text-coral" : text.tone === "down" ? "text-sea" : "text-cream/50"}`}>{text.text}</span>
                    </span>
                  </label>
                );
              })}
              {choices.some((c) => !c.allowed) && <p className="text-[11px] text-cream/50">Only a manager can keep the original rate.</p>}
            </fieldset>
          )}
          <div className="flex items-center justify-between pt-1.5 border-t border-cream/10">
            <span className="text-xs text-cream/60">Current total</span>
            <span className="text-sm text-cream">{formatBaht(quote.currentTotalPrice)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-cream/60">New booking total</span>
            <span className="font-display italic text-xl text-coral">{formatBaht(figures.total)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-cream/60">Change vs. current total</span>
            <span className={`text-sm font-medium ${change.tone === "up" ? "text-coral" : change.tone === "down" ? "text-sea" : "text-cream/50"}`}>{change.text}</span>
          </div>
        </div>
      )}
      {status === "ready" && quote && quote.available && <PaidPriceNotice reopensPaid={quote.reopensPaid} paidWarning={quote.paidWarning} />}
      {status === "ready" && quote && !quote.available && <p className="text-xs text-coral">{quote.reason}</p>}
      {error && <p className="text-xs text-coral">{error}</p>}

      <div className="flex gap-2 flex-wrap">
        {(status === "ready" || status === "applying") && quote ? (
          <button
            type="button"
            onClick={handleApply}
            disabled={!quote.available || status === "applying"}
            className="rounded-full bg-coral hover:bg-coraldeep transition-colors px-4 py-2 text-xs font-medium disabled:opacity-60"
          >
            {status === "applying" ? "Moving…" : "Confirm relocation"}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => void handleQuote()}
            disabled={!effectiveDate || missingUnit || status === "quoting"}
            className="rounded-full border border-cream/25 hover:border-cream/50 transition-colors px-4 py-2 text-xs font-medium disabled:opacity-40"
          >
            {status === "quoting" ? "Pricing…" : "Preview relocation"}
          </button>
        )}
        <button type="button" onClick={onClose} className="text-xs text-cream/50 hover:text-cream transition-colors">
          Cancel
        </button>
      </div>
    </div>
  );
}

export function RelocateForm({ booking, canManage, onSaved }: { booking: Booking; canManage: boolean; onSaved: () => void }) {
  const [open, setOpen] = useState(false);

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
    <div className="mt-3">
      <RelocationPanel booking={booking} canManage={canManage} onClose={() => setOpen(false)} onSaved={onSaved} />
    </div>
  );
}

// The same form as a dialog, for a bar dropped on another room's row in the calendar: the drop only
// says where the guest should go, and this is where the date, the rate and the new total are
// confirmed before anything is written (a drag never changes a stay without a confirmation).
export function RelocationDialog({
  booking,
  canManage,
  preset,
  onClose,
  onSaved,
}: {
  booking: Booking;
  canManage: boolean;
  preset: RelocationPreset;
  onClose: () => void;
  onSaved: () => void;
}) {
  useCloseOnBrowserBack(true, onClose);
  return (
    <div className="fixed inset-0 z-[60] bg-ink/80 flex items-center justify-center p-4 overflow-y-auto" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label="Relocate guest" className="max-w-md w-full text-left" onClick={(e) => e.stopPropagation()}>
        <RelocationPanel booking={booking} canManage={canManage} preset={preset} heading={`Relocate ${booking.guestName}`} onClose={onClose} onSaved={onSaved} />
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
  const [quote, setQuote] = useState<RepriceQuote | null>(null);
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
              {quote!.nightsRepriced} night{quote!.nightsRepriced === 1 ? "" : "s"}:{" "}
              {formatBaht(quote!.oldTotalPrice)} → {formatBaht(quote!.newTotalPrice)}
            </p>
          )}
          <PaidPriceNotice reopensPaid={quote!.reopensPaid} paidWarning={quote!.paidWarning} />
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
