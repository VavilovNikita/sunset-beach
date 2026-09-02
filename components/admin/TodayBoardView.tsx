"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { checkInBooking, checkOutBooking, markBookingNoShow } from "@/lib/bookingOccupancyClient";
import type { TodayBoard, TodayBoardEntry } from "@/lib/types";

// The front desk's daily working set - see openapi.yaml's TodayBoard description for exactly
// which booking lands in which of the three lists. Data comes down as server-rendered props
// (app/admin/(dashboard)/today/page.tsx); actions call the backend directly and then
// router.refresh() to get the next fresh board, the same pattern BookingStatusForm.tsx already
// uses - there's no client-side re-fetch/reconcile logic to keep in sync with the server's own
// grouping rules.
//
// A row can carry a message worth reading (check-in into a dirty room; check-out with money
// still owed) that the *next* refresh would otherwise remove along with the row - a booking
// leaves "arriving" the moment it's checked in, and leaves "departing"/"in-house" the moment
// it's checked out. Refreshing immediately would make the warning flash and vanish before
// anyone reads it, on exactly the two messages this screen exists to surface. So a message
// pauses the refresh until it's dismissed; only a message-free result refreshes right away.
export default function TodayBoardView({ initialBoard }: { initialBoard: TodayBoard }) {
  const router = useRouter();

  function refresh() {
    router.refresh();
  }

  return (
    <div className="space-y-10">
      <Section
        title="Arriving today"
        entries={initialBoard.arrivingToday}
        action="checkin"
        onDone={refresh}
        empty="No arrivals today."
      />
      <Section
        title="Departing today"
        entries={initialBoard.departingToday}
        action="checkout"
        onDone={refresh}
        empty="No departures today."
      />
      <Section title="In-house" entries={initialBoard.inHouse} action="checkout" onDone={refresh} empty="No one is currently checked in." />
    </div>
  );
}

function Section({
  title,
  entries,
  action,
  onDone,
  empty,
}: {
  title: string;
  entries: TodayBoardEntry[];
  action: "checkin" | "checkout";
  onDone: () => void;
  empty: string;
}) {
  return (
    <div>
      <p className="eyebrow text-sea mb-3">
        {title} <span className="text-cream/40">({entries.length})</span>
      </p>
      {entries.length === 0 ? (
        <p className="text-sm text-cream/40">{empty}</p>
      ) : (
        <div className="space-y-2">
          {entries.map((entry) => (
            <TodayRow key={entry.booking.id} entry={entry} action={action} onDone={onDone} />
          ))}
        </div>
      )}
    </div>
  );
}

function TodayRow({ entry, action, onDone }: { entry: TodayBoardEntry; action: "checkin" | "checkout"; onDone: () => void }) {
  const { booking, outstandingBalance } = entry;
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; tone: "warning" | "error"; holdsRefresh: boolean } | null>(null);

  const needsRoom = booking.roomUnitId === null;
  const roomDirty = booking.roomUnit?.housekeepingStatus === "DIRTY";
  const owed = Number(outstandingBalance) > 0;

  async function handleCheckIn() {
    setBusy(true);
    setMessage(null);
    const result = await checkInBooking(booking.id);
    setBusy(false);
    if (!result.ok) {
      setMessage({ text: result.error, tone: "error", holdsRefresh: false });
      return;
    }
    if (result.result.warning) {
      setMessage({ text: result.result.warning, tone: "warning", holdsRefresh: true });
      return;
    }
    onDone();
  }

  async function handleCheckOut() {
    setBusy(true);
    setMessage(null);
    const result = await checkOutBooking(booking.id);
    setBusy(false);
    if (!result.ok) {
      setMessage({ text: result.error, tone: "error", holdsRefresh: false });
      return;
    }
    const stillOwed = Number(result.result.outstandingBalance);
    if (stillOwed > 0) {
      setMessage({
        text: `฿${stillOwed.toLocaleString("en-US")} still owed — collect before the guest leaves.`,
        tone: "warning",
        holdsRefresh: true,
      });
      return;
    }
    onDone();
  }

  async function handleNoShow() {
    if (!window.confirm(`Mark ${booking.guestName} as a no-show?`)) return;
    setBusy(true);
    setMessage(null);
    const result = await markBookingNoShow(booking.id);
    setBusy(false);
    if (!result.ok) {
      setMessage({ text: result.error, tone: "error", holdsRefresh: false });
      return;
    }
    onDone();
  }

  return (
    <div className="bg-ink2/40 border border-cream/10 rounded-xl p-4 flex items-center justify-between gap-4 flex-wrap">
      <div className="min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <Link href={`/admin/bookings/${booking.id}`} className="text-cream hover:text-coral transition-colors font-medium truncate">
            {booking.guestName}
          </Link>
          <span className="text-xs text-cream/50 truncate">
            {booking.room.name}
            {booking.roomUnit ? ` — ${booking.roomUnit.label}` : ""}
          </span>
        </div>
        <div className="flex items-center gap-3 flex-wrap mt-1 text-xs">
          {needsRoom && <span className="text-amber-400">No room assigned</span>}
          {roomDirty && <span className="text-coral">Room not clean</span>}
          {owed && <span className="text-coral">฿{Number(outstandingBalance).toLocaleString("en-US")} owed</span>}
        </div>
        {message && (
          <div className="mt-2 flex items-center gap-3">
            <p className={`text-xs ${message.tone === "error" ? "text-coral" : "text-amber-400"}`}>{message.text}</p>
            {message.holdsRefresh && (
              <button
                type="button"
                onClick={onDone}
                className="text-xs text-sea hover:text-coral transition-colors underline underline-offset-4 shrink-0"
              >
                OK
              </button>
            )}
          </div>
        )}
      </div>
      <div className="flex gap-2 shrink-0">
        {action === "checkin" && (
          <>
            <button
              type="button"
              onClick={handleCheckIn}
              disabled={busy || needsRoom}
              title={needsRoom ? "Assign a room before checking in" : undefined}
              className="rounded-full bg-coral hover:bg-coraldeep transition-colors px-4 py-2 text-sm font-medium disabled:opacity-50"
            >
              {busy ? "…" : "Check in"}
            </button>
            <button
              type="button"
              onClick={handleNoShow}
              disabled={busy}
              className="rounded-full border border-cream/25 hover:border-cream/50 transition-colors px-4 py-2 text-sm font-medium disabled:opacity-50"
            >
              No-show
            </button>
          </>
        )}
        {action === "checkout" && (
          <button
            type="button"
            onClick={handleCheckOut}
            disabled={busy}
            className="rounded-full bg-coral hover:bg-coraldeep transition-colors px-4 py-2 text-sm font-medium disabled:opacity-50"
          >
            {busy ? "…" : "Check out"}
          </button>
        )}
      </div>
    </div>
  );
}
