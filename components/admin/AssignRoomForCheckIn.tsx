"use client";

import { useEffect, useId, useState } from "react";
import { adminRequest } from "@/lib/adminFetch";
import { fetchAvailability } from "@/lib/availabilityClient";
import { assignBookingSegmentRoomUnit } from "@/lib/bookingSegmentClient";
import { busyUnits, monthsOfRange } from "@/lib/relocationUnits";
import { sortUnitsByLabel } from "@/lib/sortRooms";
import { formatDateRange } from "@/lib/formatDate";
import type { CheckInRoomNeeded, RoomUnit } from "@/lib/types";

// Tonight has no room, so check-in is refused: the server's sentence and the picker for exactly the part of the stay
// it names (Booking.checkInRoomNeeded) - not the booking as a whole, whose "room" is the last part's. Used by the Today
// board, the booking page and the property map. Taken rooms are marked from the server's availability, as a hint only:
// the server decides on save.
export default function AssignRoomForCheckIn({
  bookingId,
  needed,
  onAssigned,
}: {
  bookingId: string;
  needed: CheckInRoomNeeded;
  onAssigned: () => void;
}) {
  const selectId = useId();
  const [units, setUnits] = useState<RoomUnit[] | null>(null);
  const [busy, setBusy] = useState<Map<string, string>>(new Map());
  const [roomUnitId, setRoomUnitId] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    adminRequest<RoomUnit[]>(`/room-units?roomId=${needed.roomId}`, undefined, "Could not load the rooms.").then((result) => {
      if (cancelled) return;
      if (!result.ok) {
        setError(result.error);
        setUnits([]);
        return;
      }
      setUnits(sortUnitsByLabel(result.data.filter((u) => u.isActive)));
    });
    Promise.all(monthsOfRange(needed.checkIn, needed.checkOut).map((month) => fetchAvailability(needed.roomId, month))).then((results) => {
      if (cancelled) return;
      setBusy(busyUnits(results.flatMap((r) => (r.ok ? r.days : [])), needed.checkIn, needed.checkOut, bookingId));
    });
    return () => {
      cancelled = true;
    };
  }, [bookingId, needed.roomId, needed.checkIn, needed.checkOut]);

  async function assign() {
    setSaving(true);
    setError(null);
    const result = await assignBookingSegmentRoomUnit(bookingId, needed.segmentId, roomUnitId);
    setSaving(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    onAssigned();
  }

  return (
    <div className="space-y-1.5">
      <p className="text-xs text-amber-400">{needed.reason}</p>
      <label htmlFor={selectId} className="block text-xs text-cream/60">
        Room for {needed.roomName}, {formatDateRange(needed.checkIn, needed.checkOut)}
      </label>
      <div className="flex flex-wrap items-center gap-2">
        <select
          id={selectId}
          value={roomUnitId}
          onChange={(e) => setRoomUnitId(e.target.value)}
          disabled={units === null || saving}
          className="min-w-[12rem] max-w-full bg-ink2 border border-cream/20 rounded-lg px-3 py-2 text-sm text-cream disabled:opacity-60"
        >
          <option value="">{units === null ? "Loading rooms…" : "Choose a room"}</option>
          {(units ?? []).map((u) => (
            <option key={u.id} value={u.id} disabled={busy.has(u.id)}>
              {u.label}
              {busy.has(u.id) ? ` — ${busy.get(u.id)}` : u.housekeepingStatus === "DIRTY" ? " · not clean" : ""}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={assign}
          disabled={!roomUnitId || saving}
          className="rounded-full border border-cream/25 hover:border-cream/50 transition-colors px-4 py-2 text-sm font-medium disabled:opacity-50"
        >
          {saving ? "Saving…" : "Assign room"}
        </button>
      </div>
      {error && <p className="text-xs text-coral">{error}</p>}
    </div>
  );
}
