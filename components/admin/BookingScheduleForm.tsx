"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { dateOnlyUTC, toDateKey } from "@/lib/bookings";
import { BookingScheduleEditor, RoomUnitAssignmentEditor } from "@/components/admin/BookingScheduleEditor";
import type { Booking, RoomUnit } from "@/lib/types";

// The booking calendar grid's drag/resize/move interactions are pointer-only - this form is the
// keyboard-and-screen-reader-reachable way to do the exact same thing, on the booking detail
// page. The dates editor and (single-segment) room-unit editor below are BookingScheduleEditor/
// RoomUnitAssignmentEditor - the same components the booking calendar's side panel
// (BookingCardPanel.tsx) uses, not a second implementation of the same logic. That used to be two
// separate forms: this one predated booking segments/relocation entirely, so it let a relocated
// booking submit an ambiguous both-dates-and-room change and only found out it was rejected after
// the round trip, where the panel's version already disabled the field that couldn't move and
// explained why up front. Sharing one component means there's exactly one place that has to know
// about relocation, not two that can drift again the way they already had once.
export default function BookingScheduleForm({
  booking,
  units,
  canEdit,
  canListUnits,
}: {
  booking: Booking;
  /** Active units of this booking's room type - empty whenever canListUnits is false. */
  units: RoomUnit[];
  /** PATCH /bookings/{id}/schedule is CASHIER+. */
  canEdit: boolean;
  /** GET /room-units (the only way to list candidates) is MANAGER+ - one tier above canEdit. */
  canListUnits: boolean;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const segments = booking.segments;
  const multiSegment = segments.length > 1;

  function handleSaved() {
    setEditing(false);
    router.refresh();
  }

  return (
    <div className="bg-ink2/40 border border-cream/10 rounded-xl p-5">
      <div className="flex items-center justify-between gap-3 mb-2">
        <p className="eyebrow text-cream/60">Dates &amp; room</p>
        {canEdit && !editing && (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="text-sm text-sea hover:text-coral transition-colors shrink-0"
          >
            Change
          </button>
        )}
      </div>

      {!editing ? (
        <div className="space-y-1 text-sm">
          {multiSegment ? (
            // A relocated booking's overall checkIn/checkOut alone would hide that it ever moved
            // rooms mid-stay - list every segment so this summary can't look like a plain,
            // never-relocated stay when it isn't one.
            <div className="space-y-1.5">
              {segments.map((segment) => (
                <p key={segment.id} className="text-cream">
                  {segment.checkIn} → {segment.checkOut} —{" "}
                  <span className="font-display italic">{segment.roomUnit?.label ?? "unassigned"}</span>
                </p>
              ))}
            </div>
          ) : (
            <>
              <p className="text-cream">
                {toDateKey(dateOnlyUTC(booking.checkIn))} → {toDateKey(dateOnlyUTC(booking.checkOut))}
              </p>
              {booking.roomUnit ? (
                <p className="text-cream/70">
                  Room <span className="font-display italic">{booking.roomUnit.label}</span>
                </p>
              ) : (
                <p className="text-amber-400">Not assigned yet</p>
              )}
            </>
          )}
          {!canEdit && <p className="text-xs text-cream/40 mt-2">Changing dates/room requires a cashier account or above.</p>}
        </div>
      ) : (
        <div className="space-y-3">
          <BookingScheduleEditor booking={booking} onSaved={handleSaved} />

          {/* Room-unit reassignment without a date change only exists as a dedicated operation
              for a single-segment booking - see RoomUnitAssignmentEditor's own comment. A
              relocated booking's segments are changed via relocate/undo-relocate on the booking
              calendar instead (BookingScheduleEditor rejects a same-dates room-only change on a
              multi-segment booking as ambiguous). */}
          {!multiSegment && canListUnits && (
            <RoomUnitAssignmentEditor booking={booking} roomUnits={units} onSaved={handleSaved} />
          )}
          {!multiSegment && !canListUnits && (
            <p className="text-xs text-cream/40">Only managers can list rooms to switch to a different one.</p>
          )}
          {multiSegment && (
            <p className="text-xs text-cream/40">
              This booking has been relocated - changing which room a segment uses is done from the booking
              calendar (relocate/undo), not here.
            </p>
          )}

          <button
            type="button"
            onClick={() => setEditing(false)}
            className="text-sm text-cream/50 hover:text-cream transition-colors"
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}
