"use client";

import { useEffect, useState } from "react";
import { useCloseOnBrowserBack } from "@/lib/useCloseOnBrowserBack";
import { createGymReservation, loadBookingsForDate } from "@/lib/gymScheduleClient";
import { durationLabel, durationOptions, maxDurationAt } from "@/lib/gymSchedule";
import { formatDate, formatDateRange } from "@/lib/formatDate";
import type { Booking, GymSchedule } from "@/lib/types";

// Opened from a click on a free slot (components/admin/GymScheduleGrid.tsx): the date and start
// arrive fixed; the hotel booking and the length are picked here. The bookings are loaded for that
// date when the form opens (a week view spans several days). The length offered is what the schedule
// on screen says can fit - before the next reservation, before closing, within the booking's 120
// minutes that day - so a doomed choice is not offered; the server still decides (a 409 is shown here).
export default function GymReservationCreateModal({
  schedule,
  date,
  startTime,
  onClose,
  onCreated,
}: {
  schedule: GymSchedule;
  date: string;
  startTime: string;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [bookings, setBookings] = useState<Booking[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [bookingId, setBookingId] = useState("");
  const [duration, setDuration] = useState(60);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useCloseOnBrowserBack(true, onClose); // Back closes the form instead of leaving the schedule

  useEffect(() => {
    let stale = false;
    loadBookingsForDate(date).then((result) => {
      if (stale) return;
      if (!result.ok) {
        setLoadError(result.error);
        setBookings([]);
        return;
      }
      setBookings(result.data);
      setBookingId((current) => current || result.data[0]?.id || "");
    });
    return () => {
      stale = true;
    };
  }, [date]);

  const max = maxDurationAt({
    reservations: schedule.reservations,
    date,
    start: startTime,
    closeTime: schedule.closeTime,
    step: schedule.stepMinutes,
    maxDuration: schedule.maxDurationMinutes,
    maxDaily: schedule.maxDailyMinutes,
    bookingId: bookingId || undefined,
  });
  const options = durationOptions(max, schedule.stepMinutes);
  // Keep the chosen length valid when the booking (and so the daily allowance) changes.
  const effectiveDuration = options.includes(duration) ? duration : (options[options.length - 1] ?? 0);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!bookingId || effectiveDuration === 0) return;
    setSaving(true);
    setError(null);
    const result = await createGymReservation({ bookingId, date, startTime, durationMinutes: effectiveDuration });
    setSaving(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    onCreated();
  }

  const selectedBooking = bookings?.find((b) => b.id === bookingId);
  const notArrived = selectedBooking?.occupancyStatus === "EXPECTED";

  return (
    <div className="fixed inset-0 z-50 bg-ink/80 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-ink2 border border-cream/15 rounded-xl p-6 max-w-md w-full" onClick={(e) => e.stopPropagation()}>
        <p className="eyebrow text-sea mb-1">Reserve the gym</p>
        <p className="text-cream/60 text-sm mb-4">
          {formatDate(date)} · from {startTime}
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="gym-booking" className="eyebrow text-cream/60 block mb-1">
              Guest / booking
            </label>
            {bookings === null ? (
              <p className="text-sm text-cream/50">Loading bookings…</p>
            ) : bookings.length === 0 ? (
              <p className="text-sm text-cream/50">{loadError ?? "No booking in the house or arriving covers this date."}</p>
            ) : (
              <select
                id="gym-booking"
                value={bookingId}
                onChange={(e) => setBookingId(e.target.value)}
                className="w-full bg-ink border border-cream/20 rounded-lg px-3 min-h-[44px] text-sm"
              >
                {bookings.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.guestName} — {b.roomUnit ? `room ${b.roomUnit.label}` : b.room.name} ({formatDateRange(b.checkIn, b.checkOut)})
                    {b.occupancyStatus === "EXPECTED" ? " · not arrived" : ""}
                  </option>
                ))}
              </select>
            )}
            {notArrived && <p className="text-xs text-amber-400 mt-1">This guest has not checked in yet. The reservation is still made.</p>}
          </div>

          <div>
            <label htmlFor="gym-duration" className="eyebrow text-cream/60 block mb-1">
              Length
            </label>
            {options.length === 0 ? (
              <p className="text-xs text-coral">
                No time can start here: the slot is taken, it is too close to closing ({schedule.closeTime}), or this booking has used its{" "}
                {schedule.maxDailyMinutes} minutes for the day.
              </p>
            ) : (
              <select
                id="gym-duration"
                value={effectiveDuration}
                onChange={(e) => setDuration(Number(e.target.value))}
                className="w-full bg-ink border border-cream/20 rounded-lg px-3 min-h-[44px] text-sm"
              >
                {options.map((d) => (
                  <option key={d} value={d}>
                    {durationLabel(d)}
                  </option>
                ))}
              </select>
            )}
            <p className="text-xs text-cream/40 mt-1">
              Free of charge. Open {schedule.openTime}–{schedule.closeTime}, at most {schedule.maxDailyMinutes} minutes a day per booking.
            </p>
          </div>

          {error && <p className="text-sm text-coral">{error}</p>}

          <div className="flex gap-3">
            <button
              type="submit"
              disabled={saving || !bookingId || effectiveDuration === 0}
              className="flex-1 rounded-full bg-coral hover:bg-coraldeep transition-colors min-h-[44px] text-sm font-medium disabled:opacity-60"
            >
              {saving ? "Reserving…" : "Reserve"}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-full border border-cream/25 hover:border-cream/50 transition-colors min-h-[44px] text-sm font-medium"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
