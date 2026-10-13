"use client";

import { useCallback, useEffect, useState } from "react";
import { cancelMyGymReservation, fetchGymSlots, fetchMyGymReservations, reserveGym } from "@/lib/guestGymClient";
import { clampGuestDate, durationLabel, durationOptions, guestDateBounds } from "@/lib/gymSchedule";
import { formatDate } from "@/lib/formatDate";
import { hotelDateKey } from "@/lib/hotelDate";
import type { GymGuestInfo, GymGuestReservation, GymSlot, GymSlotDay } from "@/lib/types";

// Every control is at least 44px: this is used from a phone.
const TOUCH = "min-h-[44px]";
const CARD = "bg-ink2/60 border border-cream/10 rounded-xl p-4";

const STATUS_LABEL: Record<GymGuestReservation["status"], string> = {
  BOOKED: "Booked",
  COMPLETED: "Done",
  CANCELLED: "Cancelled",
};

const NOT_CHECKED_IN = "The gym can be booked once you have checked in at the front desk.";

// Gym booking for a signed-in guest (app/guest/gym/page.tsx). The server decides everything: whether
// this account has a CHECKED_IN booking, which times are free, how long a session may be, and the
// 120 minutes a day. Here: pick a date within the stay, a free time, a length, and see/cancel your
// own bookings. A 403 means "not checked in (any more)", a 409 "someone took that time / the day is
// full" - each said in plain words next to the control, and the free times are re-read.
export default function GuestGymClient({ info, initialReservations }: { info: GymGuestInfo; initialReservations: GymGuestReservation[] }) {
  const [reservations, setReservations] = useState(initialReservations);
  const [bookingId, setBookingId] = useState(info.stays[0]?.bookingId ?? "");
  const stay = info.stays.find((s) => s.bookingId === bookingId) ?? null;
  const today = hotelDateKey(new Date());
  const bounds = stay ? guestDateBounds(stay, today) : null;

  const [date, setDate] = useState(bounds ? clampGuestDate(today, bounds) : today);
  const [day, setDay] = useState<GymSlotDay | null>(null);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [slotsError, setSlotsError] = useState<string | null>(null);
  const [picked, setPicked] = useState<GymSlot | null>(null);
  const [duration, setDuration] = useState(60);
  const [booking, setBooking] = useState(false);
  const [bookError, setBookError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [lostEligibility, setLostEligibility] = useState(false);

  const [cancelling, setCancelling] = useState<string | null>(null); // the id being confirmed
  const [cancelBusy, setCancelBusy] = useState(false);
  const [cancelError, setCancelError] = useState<{ id: string; message: string } | null>(null);

  const eligible = info.eligible && !lostEligibility;

  const loadSlots = useCallback(async () => {
    if (!eligible || !bookingId || !bounds) return;
    setLoadingSlots(true);
    setSlotsError(null);
    const result = await fetchGymSlots(date, info.stays.length > 1 ? bookingId : undefined);
    setLoadingSlots(false);
    if (!result.ok) {
      if (result.status === 403) setLostEligibility(true);
      setDay(null);
      setSlotsError(result.status === 403 ? NOT_CHECKED_IN : result.error);
      return;
    }
    setDay(result.data);
    // A time that is no longer free (someone booked it, or it has just passed) must not stay picked.
    setPicked((current) => (current && result.data.slots.find((s) => s.startTime === current.startTime)?.status === "FREE" ? current : null));
  }, [eligible, bookingId, bounds?.min, bounds?.max, date, info.stays.length]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    loadSlots();
  }, [loadSlots]);

  // Whatever is picked, the length must be one the server said fits at that time.
  const maxDuration = picked ? picked.maxDurationMinutes : 0;
  const options = durationOptions(maxDuration, info.stepMinutes);
  const effectiveDuration = options.includes(duration) ? duration : (options[Math.min(options.length, 2) - 1] ?? 0);

  async function refreshReservations() {
    const result = await fetchMyGymReservations();
    if (result.ok) setReservations(result.data);
  }

  async function book() {
    if (!picked || effectiveDuration === 0) return;
    setBooking(true);
    setBookError(null);
    setNotice(null);
    const result = await reserveGym({
      bookingId: info.stays.length > 1 ? bookingId : undefined,
      date,
      startTime: picked.startTime,
      durationMinutes: effectiveDuration,
    });
    setBooking(false);
    if (!result.ok) {
      if (result.status === 403) {
        setLostEligibility(true);
        setBookError(NOT_CHECKED_IN);
        return;
      }
      setBookError(
        result.status === 409
          ? `${result.error} Pick another time — the free times below are up to date.`
          : result.error
      );
      await loadSlots();
      return;
    }
    setNotice(`Booked: ${formatDate(result.data.date)}, ${result.data.startTime}–${result.data.endTime}.`);
    setPicked(null);
    await Promise.all([refreshReservations(), loadSlots()]);
  }

  async function cancel(id: string) {
    setCancelBusy(true);
    setCancelError(null);
    const result = await cancelMyGymReservation(id);
    setCancelBusy(false);
    if (!result.ok) {
      setCancelError({ id, message: result.error });
      await refreshReservations();
      return;
    }
    setCancelling(null);
    setNotice("Your booking was cancelled.");
    await Promise.all([refreshReservations(), loadSlots()]);
  }

  const upcoming = reservations.filter((r) => r.status === "BOOKED");
  const earlier = reservations.filter((r) => r.status !== "BOOKED");

  return (
    <div className="space-y-10">
      {!eligible ? (
        <div className={CARD}>
          <p className="text-sm text-cream/80">{lostEligibility ? NOT_CHECKED_IN : (info.message ?? NOT_CHECKED_IN)}</p>
          <p className="text-xs text-cream/50 mt-2">Ask the front desk if you have just arrived.</p>
        </div>
      ) : !bounds ? (
        <div className={CARD}>
          <p className="text-sm text-cream/80">Your stay is over, so there are no days left to book.</p>
        </div>
      ) : (
        <section aria-labelledby="gym-book">
          <h2 id="gym-book" className="eyebrow text-cream/60 mb-4">
            Book a time
          </h2>

          {info.stays.length > 1 && (
            <div className="mb-4">
              <label htmlFor="gym-stay" className="text-xs text-cream/60 block mb-1">
                Which stay
              </label>
              <select
                id="gym-stay"
                value={bookingId}
                onChange={(e) => {
                  setBookingId(e.target.value);
                  setPicked(null);
                  setNotice(null);
                }}
                className={`${TOUCH} w-full bg-ink border border-cream/20 rounded-lg px-3 text-sm`}
              >
                {info.stays.map((s) => (
                  <option key={s.bookingId} value={s.bookingId}>
                    {s.roomLabel ? `Room ${s.roomLabel}` : "Your room"} · {formatDate(s.checkIn)} – {formatDate(s.checkOut)}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="mb-4">
            <label htmlFor="gym-date" className="text-xs text-cream/60 block mb-1">
              Date (during your stay: {formatDate(bounds.min)} – {formatDate(bounds.max)})
            </label>
            <input
              id="gym-date"
              type="date"
              min={bounds.min}
              max={bounds.max}
              value={date}
              onChange={(e) => {
                if (!e.target.value) return;
                setDate(clampGuestDate(e.target.value, bounds));
                setPicked(null);
                setNotice(null);
                setBookError(null);
              }}
              className={`${TOUCH} w-full bg-ink border border-cream/20 rounded-lg px-3 text-sm`}
            />
          </div>

          {slotsError && <p className="text-sm text-coral mb-3">{slotsError}</p>}
          {loadingSlots && !day && <p className="text-sm text-cream/50">Loading free times…</p>}

          {day && (
            <>
              <p className="text-xs text-cream/50 mb-2">
                Open {day.openTime}–{day.closeTime}. You have {day.remainingMinutes} of {info.maxDailyMinutes} minutes left on this day.
              </p>
              {day.remainingMinutes < info.stepMinutes && (
                <p className="text-sm text-amber-400 mb-3">You have used all {info.maxDailyMinutes} gym minutes for this day — pick another day.</p>
              )}
              <ul className="grid grid-cols-3 sm:grid-cols-4 gap-2" aria-label="Times">
                {day.slots.map((slot) => {
                  const free = slot.status === "FREE";
                  const isPicked = picked?.startTime === slot.startTime;
                  return (
                    <li key={slot.startTime}>
                      <button
                        type="button"
                        disabled={!free}
                        aria-pressed={isPicked}
                        onClick={() => {
                          setPicked(slot);
                          setBookError(null);
                          setNotice(null);
                        }}
                        className={`${TOUCH} w-full rounded-lg border text-sm transition-colors ${
                          isPicked
                            ? "bg-coral border-coral text-cream"
                            : free
                              ? "border-cream/25 hover:border-coral"
                              : "border-cream/10 text-cream/30 cursor-not-allowed"
                        } ${slot.status === "TAKEN" ? "line-through" : ""}`}
                        title={slot.status === "TAKEN" ? "Someone else has this time" : slot.status === "PAST" ? "This time has passed" : undefined}
                      >
                        {slot.startTime}
                      </button>
                    </li>
                  );
                })}
              </ul>
              {day.slots.every((s) => s.status !== "FREE") && day.remainingMinutes >= info.stepMinutes && (
                <p className="text-sm text-cream/60 mt-3">No free times left on this day.</p>
              )}
              <p className="text-xs text-cream/40 mt-2">Crossed out — taken by someone else. Greyed out — already passed.</p>
            </>
          )}

          {picked && (
            <div className={`${CARD} mt-5`}>
              <p className="text-sm text-cream mb-3">
                {formatDate(date)}, from {picked.startTime}
              </p>
              <p className="text-xs text-cream/60 mb-2">How long (up to {durationLabel(maxDuration)} from this time)</p>
              <div className="flex flex-wrap gap-2 mb-4" role="group" aria-label="Length">
                {options.map((d) => (
                  <button
                    key={d}
                    type="button"
                    aria-pressed={effectiveDuration === d}
                    onClick={() => setDuration(d)}
                    className={`${TOUCH} min-w-[44px] px-4 rounded-full border text-sm transition-colors ${
                      effectiveDuration === d ? "bg-coral border-coral text-cream" : "border-cream/25 hover:border-coral"
                    }`}
                  >
                    {durationLabel(d)}
                  </button>
                ))}
              </div>
              <button
                type="button"
                disabled={booking || effectiveDuration === 0}
                onClick={book}
                className={`${TOUCH} w-full rounded-full bg-coral hover:bg-coraldeep transition-colors text-sm font-medium disabled:opacity-60`}
              >
                {booking ? "Booking…" : `Book ${picked.startTime}–${endOf(picked.startTime, effectiveDuration)}`}
              </button>
            </div>
          )}

          {bookError && <p className="text-sm text-coral mt-3">{bookError}</p>}
          {notice && <p className="text-sm text-sea mt-3">{notice}</p>}
        </section>
      )}

      <section aria-labelledby="gym-mine">
        <h2 id="gym-mine" className="eyebrow text-cream/60 mb-4">
          Your gym bookings
        </h2>
        {reservations.length === 0 ? (
          <p className="text-cream/50 bg-ink2/40 border border-cream/10 rounded-xl p-5 text-sm">No gym bookings yet.</p>
        ) : (
          <ul className="space-y-3">
            {[...upcoming, ...earlier].map((r) => (
              <li key={r.id} className={CARD}>
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-medium">{formatDate(r.date)}</p>
                    <p className="text-sm text-cream/60">
                      {r.startTime}–{r.endTime} · {durationLabel(r.durationMinutes)}
                    </p>
                  </div>
                  <span className={`text-sm ${r.status === "BOOKED" ? "text-sea" : "text-cream/50"}`}>{STATUS_LABEL[r.status]}</span>
                </div>
                {r.canCancel && cancelling !== r.id && (
                  <button
                    type="button"
                    onClick={() => {
                      setCancelling(r.id);
                      setCancelError(null);
                    }}
                    className={`${TOUCH} mt-3 px-4 rounded-full border border-cream/25 hover:border-coral text-sm transition-colors`}
                  >
                    Cancel this booking
                  </button>
                )}
                {cancelling === r.id && (
                  <div className="mt-3">
                    <p className="text-sm text-cream/80 mb-2">Cancel {r.startTime}–{r.endTime} on {formatDate(r.date)}?</p>
                    <div className="flex gap-2 flex-wrap">
                      <button
                        type="button"
                        disabled={cancelBusy}
                        onClick={() => cancel(r.id)}
                        className={`${TOUCH} px-5 rounded-full bg-coral hover:bg-coraldeep text-sm font-medium transition-colors disabled:opacity-60`}
                      >
                        {cancelBusy ? "Cancelling…" : "Yes, cancel"}
                      </button>
                      <button
                        type="button"
                        disabled={cancelBusy}
                        onClick={() => setCancelling(null)}
                        className={`${TOUCH} px-4 text-sm text-cream/60 hover:text-cream transition-colors`}
                      >
                        Keep it
                      </button>
                    </div>
                  </div>
                )}
                {cancelError?.id === r.id && <p className="text-sm text-coral mt-2">{cancelError.message}</p>}
                {r.status === "BOOKED" && !r.canCancel && (
                  <p className="text-xs text-cream/50 mt-2">This session has started. To change it, ask the front desk.</p>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

// HH:mm + minutes, for the label on the Book button only (the server computes the real end).
function endOf(start: string, minutes: number): string {
  const total = Number(start.slice(0, 2)) * 60 + Number(start.slice(3)) + minutes;
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}
