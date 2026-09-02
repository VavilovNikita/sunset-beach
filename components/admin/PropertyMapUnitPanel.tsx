"use client";

import { useState } from "react";
import Link from "next/link";
import { checkInBooking, checkOutBooking } from "@/lib/bookingOccupancyClient";
import { updateRoomUnitHousekeeping } from "@/lib/roomUnitHousekeepingClient";
import type { PropertyMapUnit } from "@/lib/types";

// Side panel for a single room clicked on the property map - same shell as BookingCardPanel.tsx
// (no dimming backdrop, so the plan stays visible while working this room; click-outside closes).
// Unlike BookingCardPanel this doesn't refetch its own data - the parent already has the full
// PropertyMapUnit from GET /property-map, so this just acts on it and asks the parent to refresh
// once an action lands (onSaved), the same way the rest of the map re-syncs after a drag save.
export default function PropertyMapUnitPanel({
  unit,
  onClose,
  onSaved,
}: {
  unit: PropertyMapUnit;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);

  const booking = unit.currentBooking;
  const isCheckedIn = booking?.occupancyStatus === "CHECKED_IN";
  const isExpectedToday = booking?.occupancyStatus === "EXPECTED";
  const owed = booking ? Number(booking.outstandingBalance) : 0;

  async function handleCheckIn() {
    if (!booking) return;
    setBusy(true);
    setError(null);
    setWarning(null);
    const result = await checkInBooking(booking.bookingId);
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    if (result.result.warning) {
      setWarning(result.result.warning);
      return;
    }
    onSaved();
  }

  async function handleCheckOut() {
    if (!booking) return;
    setBusy(true);
    setError(null);
    setWarning(null);
    const result = await checkOutBooking(booking.bookingId);
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    const stillOwed = Number(result.result.outstandingBalance);
    if (stillOwed > 0) {
      setWarning(`฿${stillOwed.toLocaleString("en-US")} still owed — collect before the guest leaves.`);
      return;
    }
    onSaved();
  }

  async function handleToggleHousekeeping() {
    setBusy(true);
    setError(null);
    const result = await updateRoomUnitHousekeeping(unit.roomUnitId, unit.housekeepingStatus === "DIRTY" ? "CLEAN" : "DIRTY");
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    onSaved();
  }

  return (
    <div className="fixed inset-0 z-40 pointer-events-none">
      <div className="absolute inset-0 pointer-events-auto" onClick={onClose} />
      <div
        className="absolute top-0 right-0 bottom-0 w-full sm:w-[400px] bg-ink2 border-l border-cream/15 shadow-2xl pointer-events-auto overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-5 border-b border-cream/10 flex items-center justify-between sticky top-0 bg-ink2 z-10">
          <p className="eyebrow text-sea">{unit.roomName}</p>
          <button onClick={onClose} className="text-cream/50 hover:text-cream transition-colors text-xl leading-none">
            ×
          </button>
        </div>

        <div className="p-5 space-y-6">
          <div>
            <h2 className="font-display italic text-2xl mb-1">{unit.unitLabel}</h2>
            {!unit.isActive && <p className="text-sm text-cream/40">Deactivated — not part of current inventory.</p>}
          </div>

          {unit.activeBlock && (
            <div className="bg-coral/10 border border-coral/30 rounded-lg px-3 py-2 text-sm">
              <p className="text-coral font-medium">Blocked today</p>
              <p className="text-cream/60 mt-1">{unit.activeBlock.reason}</p>
              <p className="text-cream/40 text-xs mt-1">
                {unit.activeBlock.fromDate} – {unit.activeBlock.toDate}
              </p>
            </div>
          )}

          {booking ? (
            <div className="space-y-2 text-sm">
              <p>
                <span className="text-cream/40">Guest:</span> {booking.guestName}
              </p>
              <p>
                <span className="text-cream/40">{isExpectedToday ? "Arriving:" : "Departing:"}</span> {booking.checkOut}
              </p>
              {owed > 0 && (
                <p className="text-coral">
                  ฿{owed.toLocaleString("en-US")} owed{isCheckedIn ? " — collect before checkout" : ""}
                </p>
              )}
              <Link
                href={`/admin/bookings/${booking.bookingId}`}
                className="inline-block text-xs text-sea hover:text-coral transition-colors underline underline-offset-4"
              >
                Open booking
              </Link>
            </div>
          ) : (
            <p className="text-sm text-cream/40">Vacant — no guest today.</p>
          )}

          <div>
            <p className="eyebrow text-cream/50 mb-1">Housekeeping</p>
            <p className="text-sm text-cream/70">{unit.housekeepingStatus === "DIRTY" ? "Not clean" : "Clean"}</p>
          </div>

          {warning && <p className="text-sm text-amber-400 bg-amber-400/10 border border-amber-400/30 rounded-lg px-3 py-2">{warning}</p>}
          {error && <p className="text-sm text-coral">{error}</p>}

          {/* Check-in/check-out/housekeeping are all CASHIER+ on the backend, the same floor as
              viewing this screen at all - no extra gate needed here (contrast with the drag
              editor and image upload, which stay MANAGER+ in the parent view). */}
          <div className="flex flex-wrap gap-2 pt-2 border-t border-cream/10">
            {isExpectedToday && (
              <button
                type="button"
                onClick={handleCheckIn}
                disabled={busy}
                className="rounded-full bg-coral hover:bg-coraldeep transition-colors px-4 py-2 text-sm font-medium disabled:opacity-50"
              >
                {busy ? "…" : "Check in"}
              </button>
            )}
            {isCheckedIn && (
              <button
                type="button"
                onClick={handleCheckOut}
                disabled={busy}
                className="rounded-full bg-coral hover:bg-coraldeep transition-colors px-4 py-2 text-sm font-medium disabled:opacity-50"
              >
                {busy ? "…" : "Check out"}
              </button>
            )}
            <button
              type="button"
              onClick={handleToggleHousekeeping}
              disabled={busy}
              className="rounded-full border border-cream/25 hover:border-cream/50 transition-colors px-4 py-2 text-sm font-medium disabled:opacity-50"
            >
              Mark {unit.housekeepingStatus === "DIRTY" ? "clean" : "dirty"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
