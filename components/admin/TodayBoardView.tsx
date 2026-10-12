"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import CheckInDialog from "@/components/admin/CheckInDialog";
import CheckOutDialog from "@/components/admin/CheckOutDialog";
import ConfirmActionDialog from "@/components/admin/ConfirmActionDialog";
import { checkInBooking, markBookingNoShow } from "@/lib/bookingOccupancyClient";
import GuestLinkEditor from "@/components/admin/GuestLinkEditor";
import { overdueLabel } from "@/lib/overstay";
import { applyCheckedIn, applyCheckedOut, applyNoShow } from "@/lib/todayBoard";
import type { CheckInResult, CheckOutResult, TodayBoard, TodayBoardEntry } from "@/lib/types";
import { formatDate } from "@/lib/formatDate";

// The front desk's daily working set - see openapi.yaml's TodayBoard description for exactly
// which booking lands in which of the three lists. Data comes down as server-rendered props
// (app/admin/(dashboard)/today/page.tsx).
//
// Anything worth reading is shown BEFORE the action, in the dialog that asks for it: a room that
// isn't clean (CheckInDialog), a balance still owed (CheckOutDialog). After an action the card
// moves at once - the board in state is updated from the response (lib/todayBoard.ts) - and
// router.refresh() then replaces it with the server's own board, so nothing here re-derives the
// server's grouping rules and a stale local guess is corrected within a request. Earlier the board
// held its refresh while a warning was on screen, so a checked-in guest sat in "Arriving" until
// someone pressed OK.
export default function TodayBoardView({ initialBoard }: { initialBoard: TodayBoard }) {
  const router = useRouter();
  const [board, setBoard] = useState(initialBoard);
  const [notice, setNotice] = useState<string | null>(null);

  // router.refresh() delivers a new initialBoard: it replaces whatever the actions guessed.
  useEffect(() => {
    setBoard(initialBoard);
  }, [initialBoard]);

  function refresh() {
    router.refresh();
  }

  function handleCheckedIn(entry: TodayBoardEntry, result: CheckInResult, warnedBefore: boolean) {
    setBoard((b) => applyCheckedIn(b, entry, result.booking));
    // The dialog already told the desk about a dirty room; only an unexpected warning is news.
    setNotice(result.warning && !warnedBefore ? `${result.booking.guestName}: ${result.warning}` : null);
    refresh();
  }

  function handleCheckedOut(entry: TodayBoardEntry, _result: CheckOutResult) {
    setBoard((b) => applyCheckedOut(b, entry.booking.id));
    setNotice(null);
    refresh();
  }

  function handleNoShow(entry: TodayBoardEntry) {
    setBoard((b) => applyNoShow(b, entry.booking.id));
    setNotice(null);
    refresh();
  }

  // Each guest appears once. The API's departingToday also carries overdue guests and inHouse is
  // every CHECKED_IN guest, so taken as-is a departure showed twice, each with its own Check out.
  // "Departing today" is the departure date itself; an overdue guest is in the house (OverstayRule)
  // and sits under In-house, first, with the overdue flag on the row.
  const departing = board.departingToday.filter((e) => !e.overdueDays);
  const departingIds = new Set(departing.map((e) => e.booking.id));
  const inHouse = board.inHouse
    .filter((e) => !departingIds.has(e.booking.id))
    .sort((a, b) => (b.overdueDays ?? 0) - (a.overdueDays ?? 0));

  const handlers = { onCheckedIn: handleCheckedIn, onCheckedOut: handleCheckedOut, onNoShow: handleNoShow, onChanged: refresh };

  return (
    <div className="space-y-10">
      {notice && (
        <div className="flex items-center gap-3 rounded-lg border border-amber-400/30 bg-amber-400/10 px-3 py-2" role="status">
          <p className="text-sm text-amber-400">{notice}</p>
          <button
            type="button"
            onClick={() => setNotice(null)}
            className="ml-auto shrink-0 text-xs text-sea hover:text-coral transition-colors underline underline-offset-4"
          >
            Dismiss
          </button>
        </div>
      )}
      <Section title="Arriving today" entries={board.arrivingToday} action="checkin" empty="No arrivals today." {...handlers} />
      <Section title="Departing today" entries={departing} action="checkout" empty="No departures today." {...handlers} />
      <Section title="In-house" entries={inHouse} action="checkout" empty="No one else is checked in." {...handlers} />
    </div>
  );
}

type RowHandlers = {
  onCheckedIn: (entry: TodayBoardEntry, result: CheckInResult, warnedBefore: boolean) => void;
  onCheckedOut: (entry: TodayBoardEntry, result: CheckOutResult) => void;
  onNoShow: (entry: TodayBoardEntry) => void;
  onChanged: () => void;
};

function Section({
  title,
  entries,
  action,
  empty,
  ...handlers
}: {
  title: string;
  entries: TodayBoardEntry[];
  action: "checkin" | "checkout";
  empty: string;
} & RowHandlers) {
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
            <TodayRow key={entry.booking.id} entry={entry} action={action} {...handlers} />
          ))}
        </div>
      )}
    </div>
  );
}

function TodayRow({
  entry,
  action,
  onCheckedIn,
  onCheckedOut,
  onNoShow,
  onChanged,
}: { entry: TodayBoardEntry; action: "checkin" | "checkout" } & RowHandlers) {
  const { booking, outstandingBalance } = entry;
  const [busy, setBusy] = useState(false);
  const [checkingIn, setCheckingIn] = useState(false);
  const [checkingOut, setCheckingOut] = useState(false);
  const [markingNoShow, setMarkingNoShow] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const needsRoom = booking.roomUnitId === null;
  const roomDirty = booking.roomUnit?.housekeepingStatus === "DIRTY";
  const owed = Number(outstandingBalance) > 0;
  const overdue = overdueLabel(entry.overdueDays);

  // A clean room is checked in straight away; a dirty one asks first (CheckInDialog).
  async function handleCheckIn() {
    if (roomDirty) {
      setCheckingIn(true);
      return;
    }
    setBusy(true);
    setError(null);
    const result = await checkInBooking(booking.id);
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    onCheckedIn(entry, result.result, false);
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
          {overdue && (
            <span className="text-coral">
              {overdue} — was due out {formatDate(booking.checkOut)}. Check out, or extend the stay from the booking.
            </span>
          )}
          {needsRoom && <span className="text-amber-400">No room assigned</span>}
          {roomDirty && <span className="text-sand">Room not clean</span>}
          {owed && <span className="text-coral">฿{Number(outstandingBalance).toLocaleString("en-US")} owed</span>}
        </div>
        {/* Optional, not a check-in blocker - check-in is the moment reception is already looking
            at this row, so it's the natural place to offer linking a guest, but the backend
            doesn't require one to check in. */}
        {action === "checkin" && (
          <div className="mt-1">
            <GuestLinkEditor booking={booking} onSaved={onChanged} />
          </div>
        )}
        {error && <p className="mt-2 text-xs text-coral">{error}</p>}
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
              onClick={() => setMarkingNoShow(true)}
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
            onClick={() => setCheckingOut(true)}
            disabled={busy}
            className="rounded-full bg-coral hover:bg-coraldeep transition-colors px-4 py-2 text-sm font-medium disabled:opacity-50"
          >
            {busy ? "…" : "Check out"}
          </button>
        )}
      </div>
      {checkingIn && (
        <CheckInDialog
          bookingId={booking.id}
          guestName={booking.guestName}
          roomLabel={booking.roomUnit?.label ?? null}
          onBack={() => setCheckingIn(false)}
          onDone={(result) => {
            setCheckingIn(false);
            onCheckedIn(entry, result, true);
          }}
        />
      )}
      {checkingOut && (
        <CheckOutDialog
          bookingId={booking.id}
          guestName={booking.guestName}
          checkOut={booking.checkOut}
          onBack={() => setCheckingOut(false)}
          onDone={(result) => {
            setCheckingOut(false);
            onCheckedOut(entry, result);
          }}
        />
      )}
      {markingNoShow && (
        <ConfirmActionDialog
          eyebrow="No-show"
          title={`Mark ${booking.guestName} as a no-show?`}
          confirmLabel="Mark no-show"
          busyLabel="Saving…"
          action={async () => {
            const result = await markBookingNoShow(booking.id);
            return result.ok ? null : result.error;
          }}
          onDone={() => {
            setMarkingNoShow(false);
            onNoShow(entry);
          }}
          onBack={() => setMarkingNoShow(false)}
        >
          <p className="text-sm text-cream/60">The booking&rsquo;s dates and price don&rsquo;t change.</p>
        </ConfirmActionDialog>
      )}
    </div>
  );
}
