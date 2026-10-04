"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { adminRequest, adminJsonInit } from "@/lib/adminFetch";
import { getNights } from "@/lib/bookings";
import { BOOKING_CHANNELS, BOOKING_CHANNEL_LABELS } from "@/lib/bookingChannel";
import { parsePartySize } from "@/lib/bookingPurpose";
import { formatDateRange } from "@/lib/formatDate";
import {
  prefillFromGuest,
  staffBookingDatesValid,
  validateStaffBookingForm,
  type StaffBookingFormErrors,
} from "@/lib/staffBookingForm";
import { quoteStaffBooking } from "@/lib/staffBookingQuoteClient";
import type { Booking, BookingChannel, BookingPurpose, BookingScheduleQuote, Guest, StaffBookingCreateInput } from "@/lib/types";
import BookingPurposePartyFields from "@/components/admin/BookingPurposePartyFields";
import GuestSearchPicker from "@/components/admin/GuestSearchPicker";

const QUOTE_DEBOUNCE_MS = 300;

// Opened two ways from the booking calendar grid, both landing here with the same props shape:
// dragging out a date range on a free row (wide-enough columns - the range is already precise,
// see DRAG_THRESHOLD_PX in lib/calendarLayout.ts), or a single click on a free cell at a denser
// zoom where a drag can't reliably land on the intended day (checkIn/checkOut default to that one
// clicked day). Either way `checkIn`/`checkOut` below are only a *starting point* - editable
// before saving, so a click that landed a day off is caught here, not after the booking exists.
//
// Creates and assigns the room in one atomic call (POST /bookings/staff) rather than the two-step
// POST /bookings + PUT /bookings/{id}/room-unit the public guest flow uses — see that
// endpoint's description for why: it would otherwise email every manager on every walk-in the
// front desk types in, require a guest email address a walk-in may not have, and leave a
// create-then-assign window where the booking exists with no room if the second call lost a race.
//
// The price shown before saving is the server's (POST /bookings/staff/quote, re-asked whenever the
// dates change) - the same pricing the create call uses, never a client-side sum. It's advisory:
// the create call re-prices, and the "Booking created" screen shows the total actually stored.
//
// An existing guest can be picked from their card (GuestSearchPicker): that fills the booking's
// own name/email/phone snapshot from the card and links the booking to exactly that card
// (guestId), instead of the server's find-or-create by email.
//
// Validation is this form's own (lib/staffBookingForm.ts), in English, next to each field - the
// form is noValidate, because the browser's own "required" bubble speaks the browser's language.
export default function BookingCreateFromGridModal({
  roomId,
  roomTypeName,
  roomUnitId,
  roomUnitLabel,
  checkIn: initialCheckIn,
  checkOut: initialCheckOut,
  onClose,
  onCreated,
}: {
  roomId: string;
  roomTypeName: string;
  roomUnitId: string;
  roomUnitLabel: string;
  checkIn: string;
  checkOut: string;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [checkIn, setCheckIn] = useState(initialCheckIn);
  const [checkOut, setCheckOut] = useState(initialCheckOut);
  const [pickedGuest, setPickedGuest] = useState<Guest | null>(null);
  const [guestName, setGuestName] = useState("");
  const [guestEmail, setGuestEmail] = useState("");
  const [guestPhone, setGuestPhone] = useState("");
  // Starts unset on purpose: the backend requires a channel with no default, and a preselected
  // value would get submitted unread just the same as a silent server-side default.
  const [channel, setChannel] = useState<BookingChannel | "">("");
  const [purpose, setPurpose] = useState<BookingPurpose>("STANDARD");
  // Adults starts empty for the same reason channel does: the backend requires it with no
  // default, so a prefilled 1 would be sent unread. Children genuinely defaults to 0.
  const [adults, setAdults] = useState("");
  const [children, setChildren] = useState("0");
  const [fieldErrors, setFieldErrors] = useState<StaffBookingFormErrors>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<Booking | null>(null);

  const [quote, setQuote] = useState<BookingScheduleQuote | null>(null);
  const [quoting, setQuoting] = useState(false);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const quoteSeq = useRef(0);

  const datesValid = staffBookingDatesValid(checkIn, checkOut);
  const nights = datesValid ? getNights(checkIn, checkOut).length : 0;

  // Re-price whenever the dates change. Only the latest answer is shown - a slow response for
  // dates the user has already changed must not overwrite the current one.
  useEffect(() => {
    setQuote(null);
    setQuoteError(null);
    if (!datesValid) {
      setQuoting(false);
      return;
    }
    const seq = ++quoteSeq.current;
    setQuoting(true);
    const timer = setTimeout(async () => {
      const result = await quoteStaffBooking({ roomId, checkIn, checkOut, roomUnitId });
      if (seq !== quoteSeq.current) return;
      setQuoting(false);
      if (!result.ok) {
        setQuoteError(result.error);
        return;
      }
      setQuote(result.data);
    }, QUOTE_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [roomId, roomUnitId, checkIn, checkOut, datesValid]);

  function handlePickGuest(guest: Guest) {
    setPickedGuest(guest);
    const prefill = prefillFromGuest(guest);
    setGuestName(prefill.guestName);
    setGuestEmail(prefill.guestEmail);
    setGuestPhone(prefill.guestPhone);
    setFieldErrors((prev) => ({ ...prev, guestName: undefined, guestEmail: undefined, guestPhone: undefined }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const errors = validateStaffBookingForm({ guestName, guestEmail, guestPhone, checkIn, checkOut, channel, adults, children });
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0 || !channel) {
      setError("Fix the highlighted fields.");
      return;
    }
    const party = parsePartySize(adults, children);
    if ("error" in party) return; // already reported by validateStaffBookingForm
    setSaving(true);
    setError(null);

    const body: StaffBookingCreateInput = {
      roomId,
      guestName: guestName.trim(),
      guestEmail: guestEmail.trim() || null,
      guestPhone: guestPhone.trim() || null,
      checkIn,
      checkOut,
      roomUnitId,
      channel,
      purpose,
      adults: party.adults,
      children: party.children,
      guestId: pickedGuest?.id ?? null,
    };

    const result = await adminRequest<Booking>("/bookings/staff", adminJsonInit("POST", body), "Could not create this booking.");
    setSaving(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setCreated(result.data);
  }

  const inputClass = (field: keyof StaffBookingFormErrors) =>
    `w-full bg-ink border rounded-lg px-3 py-2 text-sm ${fieldErrors[field] ? "border-coral" : "border-cream/20"}`;
  const fieldError = (field: keyof StaffBookingFormErrors) =>
    fieldErrors[field] ? <p className="text-xs text-coral mt-1">{fieldErrors[field]}</p> : null;

  return (
    <div className="fixed inset-0 z-50 bg-ink/80 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-ink2 border border-cream/15 rounded-xl p-6 max-w-md w-full max-h-[calc(100vh-2rem)] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {created ? (
          <div className="space-y-4">
            <p className="eyebrow text-sea">Booking created</p>
            <p className="text-cream">
              {created.guestName} — {roomUnitLabel} ({roomTypeName})
            </p>
            <p className="text-sm text-cream/60">
              {formatDateRange(created.checkIn, created.checkOut)} ({nights} night{nights === 1 ? "" : "s"})
            </p>
            <p className="font-display italic text-3xl text-coral">฿{Number(created.totalPrice).toLocaleString("en-US")}</p>
            {created.guest && <p className="text-xs text-cream/50">Linked to guest card {created.guest.name}.</p>}
            <div className="flex gap-3">
              <Link
                href={`/admin/bookings/${created.id}`}
                className="flex-1 text-center rounded-full bg-coral hover:bg-coraldeep transition-colors px-5 py-2.5 text-sm font-medium"
              >
                Open booking
              </Link>
              <button
                type="button"
                onClick={onCreated}
                className="flex-1 rounded-full border border-cream/25 hover:border-cream/50 transition-colors px-5 py-2.5 text-sm font-medium"
              >
                Done
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={submit} noValidate className="space-y-4">
            <div>
              <p className="eyebrow text-sea mb-1">New booking</p>
              <p className="text-cream">
                {roomTypeName} — {roomUnitLabel}
              </p>
              <p className="text-xs text-cream/40 mt-1">
                Fields marked <span className="text-coral">*</span> are required.
              </p>
            </div>

            <div className="flex gap-3">
              <div className="flex-1">
                <label className="eyebrow text-cream/60 block mb-1">
                  Check-in <span className="text-coral">*</span>
                </label>
                <input type="date" value={checkIn} onChange={(e) => setCheckIn(e.target.value)} className={inputClass("checkIn")} />
                {fieldError("checkIn")}
              </div>
              <div className="flex-1">
                <label className="eyebrow text-cream/60 block mb-1">
                  Check-out <span className="text-coral">*</span>
                </label>
                <input type="date" value={checkOut} onChange={(e) => setCheckOut(e.target.value)} className={inputClass("checkOut")} />
                {fieldError("checkOut")}
              </div>
            </div>

            {/* Prefilled from the click/drag on the grid but always editable above - a single
                click at a dense zoom only aims at the day, not the exact range, so this is where
                a wrong guess gets caught before the booking is created, not after. The price is
                the server's quote for these dates. */}
            <div className="bg-ink border border-cream/10 rounded-lg px-3 py-2 text-sm">
              {!datesValid ? (
                <span className="text-cream/50">Pick a check-out after check-in to see the price.</span>
              ) : quoting ? (
                <span className="text-cream/50">
                  {nights} night{nights === 1 ? "" : "s"} · pricing…
                </span>
              ) : quoteError ? (
                <span className="text-coral">{quoteError}</span>
              ) : quote ? (
                <div>
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-cream/60">
                      {quote.nights} night{quote.nights === 1 ? "" : "s"}
                    </span>
                    <span className="font-display italic text-2xl text-coral">฿{Number(quote.totalPrice).toLocaleString("en-US")}</span>
                  </div>
                  {!quote.available && <p className="text-xs text-coral mt-1">{quote.reason ?? "This room isn't free for these dates."}</p>}
                </div>
              ) : null}
            </div>

            <div>
              <label className="eyebrow text-cream/60 block mb-1">Existing guest</label>
              <GuestSearchPicker picked={pickedGuest} onPick={handlePickGuest} onClear={() => setPickedGuest(null)} />
            </div>

            <div>
              <label className="eyebrow text-cream/60 block mb-1">
                Guest name <span className="text-coral">*</span>
              </label>
              <input
                type="text"
                value={guestName}
                onChange={(e) => setGuestName(e.target.value)}
                autoFocus
                className={inputClass("guestName")}
              />
              {fieldError("guestName")}
            </div>
            <div>
              <label className="eyebrow text-cream/60 block mb-1">Email</label>
              <input
                type="email"
                value={guestEmail}
                onChange={(e) => setGuestEmail(e.target.value)}
                placeholder="Walk-in — leave blank if none"
                className={inputClass("guestEmail")}
              />
              {fieldError("guestEmail")}
            </div>
            <div>
              <label className="eyebrow text-cream/60 block mb-1">Phone</label>
              <input type="tel" value={guestPhone} onChange={(e) => setGuestPhone(e.target.value)} className={inputClass("guestPhone")} />
              {fieldError("guestPhone")}
            </div>

            <div>
              <label className="eyebrow text-cream/60 block mb-1">
                Channel <span className="text-coral">*</span>
              </label>
              <select value={channel} onChange={(e) => setChannel(e.target.value as BookingChannel)} className={inputClass("channel")}>
                <option value="" disabled>
                  How did this booking come in?
                </option>
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
              onPurposeChange={setPurpose}
              adults={adults}
              onAdultsChange={setAdults}
              childCount={children}
              onChildCountChange={setChildren}
              inputClassName="w-full bg-ink border border-cream/20 rounded-lg px-3 py-2 text-sm"
              adultsError={fieldErrors.adults}
              childrenError={fieldErrors.children}
            />

            {error && <p className="text-sm text-coral">{error}</p>}

            <div className="flex gap-3">
              <button
                type="submit"
                disabled={saving}
                className="rounded-full bg-coral hover:bg-coraldeep transition-colors px-5 py-2.5 text-sm font-medium disabled:opacity-60"
              >
                {saving ? "Creating…" : "Create booking"}
              </button>
              <button type="button" onClick={onClose} className="text-sm text-cream/60 hover:text-cream transition-colors">
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
