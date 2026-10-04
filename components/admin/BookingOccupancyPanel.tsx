"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import CheckOutDialog from "@/components/admin/CheckOutDialog";
import { checkInBooking, markBookingNoShow } from "@/lib/bookingOccupancyClient";
import { hotelDateKey } from "@/lib/hotelDate";
import { overdueDaysFor, overdueLabel } from "@/lib/overstay";
import type { Booking } from "@/lib/types";
import { formatDate } from "@/lib/formatDate";

const OCCUPANCY_LABELS: Record<Booking["occupancyStatus"], string> = {
  EXPECTED: "Expected",
  CHECKED_IN: "Checked in",
  CHECKED_OUT: "Checked out",
  NO_SHOW: "No-show",
};

// Check-in / no-show / check-out on the booking itself - the same three POST /bookings/{id}/...
// calls the Today board makes, offered here because the night audit sends the desk to this page
// to resolve a missed arrival or departure, and the Today board only lists today's arrivals. So
// a guest who arrived a day late, one who never came, and one who should have left days ago (the
// backend's OverstayRule) all have a working path from here. Nothing here moves dates or money:
// a no-show stays a label (cancel or shorten the booking separately to release nights), and an
// overdue guest who is really still staying gets their stay extended with the schedule form
// below, which prices the extra nights. Check-out goes through CheckOutDialog, which is where an
// early departure can shorten the stay.
//
// balanceDue is the folio's own figure (null when the folio didn't load), shown for as long as it
// is above zero - not a one-off message after check-out, which used to vanish after a partial
// payment while money was still owed.
export default function BookingOccupancyPanel({ booking, balanceDue }: { booking: Booking; balanceDue: string | null }) {
  const router = useRouter();
  const [checkingOut, setCheckingOut] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; tone: "warning" | "error" } | null>(null);

  const today = hotelDateKey(new Date());
  const cancelled = booking.status === "CANCELLED";
  const arrivalDue = booking.checkIn <= today;
  const occupancy = booking.occupancyStatus;
  const overdue = overdueLabel(overdueDaysFor(booking, today));

  async function run(action: () => Promise<{ ok: true; warning: string | null } | { ok: false; error: string }>) {
    setBusy(true);
    setMessage(null);
    const result = await action();
    setBusy(false);
    if (!result.ok) {
      setMessage({ text: result.error, tone: "error" });
      return;
    }
    if (result.warning) setMessage({ text: result.warning, tone: "warning" });
    router.refresh();
  }

  function handleCheckIn() {
    return run(async () => {
      const result = await checkInBooking(booking.id);
      return result.ok ? { ok: true, warning: result.result.warning } : result;
    });
  }

  function handleNoShow() {
    if (!window.confirm(`Mark ${booking.guestName} as a no-show? The booking's dates and price don't change.`)) return;
    return run(async () => {
      const result = await markBookingNoShow(booking.id);
      return result.ok ? { ok: true, warning: null } : result;
    });
  }


  const canCheckIn = !cancelled && arrivalDue && (occupancy === "EXPECTED" || occupancy === "NO_SHOW");
  const canMarkNoShow = !cancelled && arrivalDue && occupancy === "EXPECTED";
  const canCheckOut = occupancy === "CHECKED_IN";
  const needsRoom = booking.roomUnitId === null;
  const owed = balanceDue !== null && Number(balanceDue) > 0;

  return (
    <div className="bg-ink2/40 border border-cream/10 rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <p className="eyebrow text-cream/50">Stay</p>
        <span className="text-sm text-cream/80">{OCCUPANCY_LABELS[occupancy]}</span>
      </div>

      {owed && (
        <p className="text-sm text-coral">
          Balance due: ฿{Number(balanceDue).toLocaleString("en-US")} — collect it in the folio below.
        </p>
      )}

      {overdue && (
        <p className="text-sm text-coral">
          {overdue} — was due out on {formatDate(booking.checkOut)} and is still checked in, so the room is held for them tonight.
          Check them out if they&rsquo;ve left, or extend the stay below if they&rsquo;re still here.
        </p>
      )}
      {occupancy === "EXPECTED" && arrivalDue && !cancelled && booking.checkIn < today && (
        <p className="text-sm text-amber-400">Was due to arrive on {formatDate(booking.checkIn)}. Check them in, or mark a no-show.</p>
      )}

      {(canCheckIn || canMarkNoShow || canCheckOut) && (
        <div className="flex flex-wrap gap-2">
          {canCheckIn && (
            <button
              type="button"
              onClick={handleCheckIn}
              disabled={busy || needsRoom}
              title={needsRoom ? "Assign a room before checking in" : undefined}
              className="rounded-full bg-coral hover:bg-coraldeep transition-colors px-4 py-2 text-sm font-medium disabled:opacity-50"
            >
              Check in
            </button>
          )}
          {canMarkNoShow && (
            <button
              type="button"
              onClick={handleNoShow}
              disabled={busy}
              className="rounded-full border border-cream/25 hover:border-cream/50 transition-colors px-4 py-2 text-sm font-medium disabled:opacity-50"
            >
              Mark no-show
            </button>
          )}
          {canCheckOut && (
            <button
              type="button"
              onClick={() => setCheckingOut(true)}
              disabled={busy}
              className="rounded-full bg-coral hover:bg-coraldeep transition-colors px-4 py-2 text-sm font-medium disabled:opacity-50"
            >
              Check out
            </button>
          )}
        </div>
      )}
      {canCheckIn && needsRoom && <p className="text-xs text-amber-400">Assign a room below before checking in.</p>}

      {message && <p className={`text-xs ${message.tone === "error" ? "text-coral" : "text-amber-400"}`}>{message.text}</p>}

      {checkingOut && (
        <CheckOutDialog
          bookingId={booking.id}
          guestName={booking.guestName}
          checkOut={booking.checkOut}
          onBack={() => setCheckingOut(false)}
          onDone={() => {
            setCheckingOut(false);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}
