"use client";

import { useState } from "react";
import { createSpaAppointment } from "@/lib/spaClient";
import { tableClash, therapistClash, therapistDay } from "@/lib/spaAvailability";
import type { MenuItem, SpaAppointment, SpaTherapist } from "@/lib/posTypes";
import type { Booking } from "@/lib/types";
import { formatDate, formatDateRange } from "@/lib/formatDate";
import { isSpaStartInPast } from "@/lib/spaAppointmentDisplay";

// Opened from a click on a free grid cell (components/admin/SpaScheduleGrid.tsx) - date/tableId/
// startTime arrive pre-filled and fixed; only the booking/therapist/treatment are picked here.
// `bookings`/`therapists`/`treatments` are all fetched server-side by the page (not here) since
// the date is already known at render time - see app/admin/(dashboard)/spa/page.tsx's own
// comment on why its bookings query is widened to [date-1, date].
//
// `dayAppointments` is the schedule already on screen: a therapist busy at this time (for the
// chosen treatment's length) is shown disabled with who they're with, and a treatment that would
// run into the next appointment on this table is flagged - before saving, not as a 409 after.
// The server's constraints still decide; this is only what the grid already knows.
export default function SpaAppointmentCreateModal({
  date,
  tableId,
  tableLabel,
  startTime,
  bookings,
  therapists,
  treatments,
  dayAppointments,
  onClose,
  onCreated,
}: {
  date: string;
  tableId: string;
  tableLabel: string;
  startTime: string;
  bookings: Booking[];
  therapists: SpaTherapist[];
  treatments: MenuItem[];
  dayAppointments: SpaAppointment[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const [bookingId, setBookingId] = useState(bookings[0]?.id ?? "");
  const [treatmentMenuItemId, setTreatmentMenuItemId] = useState(treatments[0]?.id ?? "");
  const durationMinutes = treatments.find((t) => t.id === treatmentMenuItemId)?.durationMinutes ?? 0;
  const clashFor = (therapistId: string) => therapistClash(dayAppointments, therapistId, startTime, durationMinutes);
  // Starts on the first therapist who is actually free, not just the first in the list.
  const [therapistUserId, setTherapistUserId] = useState(
    () => (therapists.find((t) => !clashFor(t.id)) ?? therapists[0])?.id ?? ""
  );
  const selectedTherapistClash = therapistUserId ? clashFor(therapistUserId) : null;
  const selectedTherapistDay = therapistUserId ? therapistDay(dayAppointments, therapistUserId) : [];
  const tableConflict = durationMinutes ? tableClash(dayAppointments, tableId, startTime, durationMinutes) : null;
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  // Read once when the modal opens - the cell was clicked "now".
  const [startsInPast] = useState(() => isSpaStartInPast(date, startTime, new Date()));
  const [pastConfirmed, setPastConfirmed] = useState(false);

  const canSubmit =
    bookingId && therapistUserId && treatmentMenuItemId && !selectedTherapistClash && !tableConflict && (!startsInPast || pastConfirmed);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setSaving(true);
    setError(null);

    const result = await createSpaAppointment({ bookingId, tableId, therapistUserId, treatmentMenuItemId, date, startTime });

    setSaving(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    if (result.result.warning) {
      setWarning(result.result.warning);
      setDone(true);
      return;
    }
    onCreated();
  }

  return (
    <div className="fixed inset-0 z-50 bg-ink/80 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-ink2 border border-cream/15 rounded-xl p-6 max-w-md w-full" onClick={(e) => e.stopPropagation()}>
        <p className="eyebrow text-sea mb-1">Book a treatment</p>
        <p className="text-cream/60 text-sm mb-4">
          {tableLabel} · {formatDate(date)} · {startTime}
        </p>

        {done ? (
          <div className="space-y-4">
            <p className="text-sm text-amber-400 bg-amber-400/10 border border-amber-400/30 rounded-lg px-3 py-2">{warning}</p>
            <button
              type="button"
              onClick={onCreated}
              className="w-full rounded-full bg-coral hover:bg-coraldeep transition-colors py-2.5 text-sm font-medium"
            >
              Done
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="eyebrow text-cream/60 block mb-1">Guest / booking</label>
              {bookings.length === 0 ? (
                <p className="text-sm text-cream/50">No bookings cover this date.</p>
              ) : (
                <select
                  value={bookingId}
                  onChange={(e) => setBookingId(e.target.value)}
                  className="w-full bg-ink border border-cream/20 rounded-lg px-3 py-2 text-sm"
                >
                  {bookings.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.guestName} — {b.room.name} ({formatDateRange(b.checkIn, b.checkOut)})
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div>
              <label className="eyebrow text-cream/60 block mb-1">Treatment</label>
              {treatments.length === 0 ? (
                <p className="text-sm text-cream/50">
                  No SPA-department menu items with a duration set yet - add one under Restaurant → Menu.
                </p>
              ) : (
                <select
                  value={treatmentMenuItemId}
                  onChange={(e) => setTreatmentMenuItemId(e.target.value)}
                  className="w-full bg-ink border border-cream/20 rounded-lg px-3 py-2 text-sm"
                >
                  {treatments.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({t.durationMinutes} min) — ฿{Number(t.price).toLocaleString("en-US")}
                    </option>
                  ))}
                </select>
              )}
              {tableConflict && (
                <p className="text-xs text-coral mt-1">
                  Runs into {tableConflict.guestName}&rsquo;s appointment on this table ({tableConflict.from}–{tableConflict.to}) — pick
                  a shorter treatment or another time.
                </p>
              )}
            </div>

            <div>
              <label className="eyebrow text-cream/60 block mb-1">Therapist</label>
              {therapists.length === 0 ? (
                <p className="text-sm text-cream/50">
                  No active staff hold the THERAPIST function yet - add one under Staff → Users.
                </p>
              ) : (
                <select
                  value={therapistUserId}
                  onChange={(e) => setTherapistUserId(e.target.value)}
                  className="w-full bg-ink border border-cream/20 rounded-lg px-3 py-2 text-sm"
                >
                  {therapists.map((t) => {
                    const clash = clashFor(t.id);
                    return (
                      <option key={t.id} value={t.id} disabled={!!clash}>
                        {clash ? `${t.name} — busy ${clash.from}–${clash.to} (${clash.guestName})` : t.name}
                      </option>
                    );
                  })}
                </select>
              )}
              {selectedTherapistClash ? (
                <p className="text-xs text-coral mt-1">
                  Busy {selectedTherapistClash.from}–{selectedTherapistClash.to} with {selectedTherapistClash.guestName} — choose
                  another therapist or time.
                </p>
              ) : (
                therapistUserId && (
                  <p className="text-xs text-cream/40 mt-1">
                    {selectedTherapistDay.length === 0
                      ? "Nothing else booked for this therapist today."
                      : `Already booked today: ${selectedTherapistDay.map((d) => `${d.from}–${d.to}`).join(", ")}`}
                  </p>
                )
              )}
            </div>

            {startsInPast && (
              <label className="flex items-start gap-2 text-sm text-amber-400 bg-amber-400/10 border border-amber-400/30 rounded-lg px-3 py-2 cursor-pointer">
                <input type="checkbox" className="mt-1" checked={pastConfirmed} onChange={(e) => setPastConfirmed(e.target.checked)} />
                <span>
                  {formatDate(date)} {startTime} has already passed. Book it anyway (e.g. recording a treatment that already
                  happened)?
                </span>
              </label>
            )}

            {error && <p className="text-sm text-coral">{error}</p>}

            <div className="flex gap-3">
              <button
                type="submit"
                disabled={saving || !canSubmit}
                className="flex-1 rounded-full bg-coral hover:bg-coraldeep transition-colors py-2.5 text-sm font-medium disabled:opacity-60"
              >
                {saving ? "Booking…" : "Book"}
              </button>
              <button
                type="button"
                onClick={onClose}
                className="flex-1 rounded-full border border-cream/25 hover:border-cream/50 transition-colors py-2.5 text-sm font-medium"
              >
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
