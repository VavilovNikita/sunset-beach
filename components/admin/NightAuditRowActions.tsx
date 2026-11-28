"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import ConfirmActionDialog from "@/components/admin/ConfirmActionDialog";
import { checkInBooking, markBookingNoShow } from "@/lib/bookingOccupancyClient";

// The two quick answers to a missed arrival, on the night-audit row itself: the guest turned up late (check in) or
// never came (mark no-show). The same two calls as the booking page's stay panel, each behind a confirmation. They
// change no dates and no money - a no-show stays a label, and releasing nights is still a cancellation or a shorter
// stay on the booking. Anything else (cancel, check out, extend) remains on the booking page, one click away.
export default function NightAuditRowActions({
  bookingId,
  guestName,
  roomNeededReason,
  canCheckIn,
  canMarkNoShow,
}: {
  bookingId: string;
  guestName: string;
  // The server's sentence when today's part of the stay has no room yet (check-in would be refused), else null.
  roomNeededReason: string | null;
  canCheckIn: boolean;
  canMarkNoShow: boolean;
}) {
  const router = useRouter();
  const [dialog, setDialog] = useState<"checkin" | "noshow" | null>(null);
  const [note, setNote] = useState<string | null>(null);

  if (!canCheckIn && !canMarkNoShow) return null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {canCheckIn && (
        <button
          type="button"
          onClick={() => setDialog("checkin")}
          disabled={roomNeededReason !== null}
          title={roomNeededReason ?? undefined}
          className="rounded-full bg-coral hover:bg-coraldeep transition-colors px-3 py-1.5 text-xs font-medium disabled:opacity-50"
        >
          Check in
        </button>
      )}
      {canMarkNoShow && (
        <button
          type="button"
          onClick={() => setDialog("noshow")}
          className="rounded-full border border-cream/25 hover:border-cream/50 transition-colors px-3 py-1.5 text-xs font-medium"
        >
          Mark no-show
        </button>
      )}
      {note && <span className="text-xs text-amber-400">{note}</span>}

      {dialog === "checkin" && (
        <ConfirmActionDialog
          eyebrow="Check-in"
          title={`Check in ${guestName} now?`}
          confirmLabel="Check in"
          busyLabel="Checking in…"
          action={async () => {
            const result = await checkInBooking(bookingId);
            if (!result.ok) return result.error;
            // A room that is not clean is a warning, not a block: the guest is in, the desk is told.
            setNote(result.result.warning);
            return null;
          }}
          onDone={() => {
            setDialog(null);
            router.refresh();
          }}
          onBack={() => setDialog(null)}
        >
          <p className="text-sm text-cream/60">If the room has not been cleaned you will be told after.</p>
        </ConfirmActionDialog>
      )}
      {dialog === "noshow" && (
        <ConfirmActionDialog
          eyebrow="No-show"
          title={`Mark ${guestName} as a no-show?`}
          confirmLabel="Mark no-show"
          busyLabel="Saving…"
          action={async () => {
            const result = await markBookingNoShow(bookingId);
            return result.ok ? null : result.error;
          }}
          onDone={() => {
            setDialog(null);
            router.refresh();
          }}
          onBack={() => setDialog(null)}
        >
          <p className="text-sm text-cream/60">The booking&rsquo;s dates and price don&rsquo;t change; the nights are not released.</p>
        </ConfirmActionDialog>
      )}
    </div>
  );
}
