"use client";

import { useState } from "react";
import { createSpaAppointment } from "@/lib/spaClient";
import type { MenuItem, SpaTherapist } from "@/lib/posTypes";
import type { Booking } from "@/lib/types";

// Opened from a click on a free grid cell (components/admin/SpaScheduleGrid.tsx) - date/tableId/
// startTime arrive pre-filled and fixed; only the booking/therapist/treatment are picked here.
// `bookings`/`therapists`/`treatments` are all fetched server-side by the page (not here) since
// the date is already known at render time - see app/admin/(dashboard)/spa/page.tsx's own
// comment on why its bookings query is widened to [date-1, date].
export default function SpaAppointmentCreateModal({
  date,
  tableId,
  tableLabel,
  startTime,
  bookings,
  therapists,
  treatments,
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
  onClose: () => void;
  onCreated: () => void;
}) {
  const [bookingId, setBookingId] = useState(bookings[0]?.id ?? "");
  const [therapistUserId, setTherapistUserId] = useState(therapists[0]?.id ?? "");
  const [treatmentMenuItemId, setTreatmentMenuItemId] = useState(treatments[0]?.id ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const canSubmit = bookingId && therapistUserId && treatmentMenuItemId;

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
          {tableLabel} · {date} · {startTime}
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
                      {b.guestName} — {b.room.name} ({b.checkIn} to {b.checkOut})
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
                  {therapists.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.email}
                    </option>
                  ))}
                </select>
              )}
            </div>

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
