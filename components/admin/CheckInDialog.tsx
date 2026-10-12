"use client";

import { useState } from "react";
import ConfirmDialog from "@/components/admin/ConfirmDialog";
import { checkInBooking } from "@/lib/bookingOccupancyClient";
import type { CheckInResult } from "@/lib/types";

// The question asked BEFORE a guest is checked into a room that is not marked clean. The backend
// only warns here (front desk is told, not blocked - a person stands at the desk and decides), and
// it used to say so in the response, after the guest was already checked in and the card had moved.
// Now the desk reads the reason first and chooses "Check in anyway" or goes back. A clean room
// needs no dialog: callers check in directly and only open this one for a dirty room.
export default function CheckInDialog({
  bookingId,
  guestName,
  roomLabel,
  onDone,
  onBack,
}: {
  bookingId: string;
  guestName: string;
  roomLabel: string | null;
  onDone: (result: CheckInResult) => void;
  onBack: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleConfirm() {
    setBusy(true);
    setError(null);
    const result = await checkInBooking(bookingId);
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    onDone(result.result);
  }

  return (
    <ConfirmDialog
      eyebrow="Check in"
      title={`Check ${guestName} in?`}
      confirmLabel="Check in anyway"
      busyLabel="Checking in…"
      busy={busy}
      error={error}
      onConfirm={handleConfirm}
      onBack={onBack}
    >
      <p className="text-sm text-amber-400">
        {roomLabel ? `Room ${roomLabel}` : "The room"} is not marked clean. Housekeeping hasn&rsquo;t released it yet, so the guest may
        walk into a room that isn&rsquo;t ready. Go back to wait for it, or check in anyway.
      </p>
    </ConfirmDialog>
  );
}
