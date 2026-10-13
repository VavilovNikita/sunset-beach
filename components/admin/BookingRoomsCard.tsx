"use client";

import { useRouter } from "next/navigation";
import { RelocateForm, RepriceSegmentButton, UndoRelocationButton } from "@/components/admin/BookingRelocation";
import { formatDateRange } from "@/lib/formatDate";
import type { Booking } from "@/lib/types";

// The room-moving half of the calendar panel's "Rooms" section, for the full booking page: every
// segment with its undo / reprice actions, and "Relocate to another room". Dates and the room unit of
// an unrelocated stay are edited in BookingScheduleForm above it - the same BookingScheduleEditor /
// RoomUnitAssignmentEditor the panel uses - so what the page lacked was only this part.
export default function BookingRoomsCard({ booking, canEdit, canManage }: { booking: Booking; canEdit: boolean; canManage: boolean }) {
  const router = useRouter();
  // A stay that is over (or never happened) can't be moved; the server refuses it too (requireStayNotEnded).
  if (!canEdit || booking.status === "CANCELLED" || booking.occupancyStatus === "CHECKED_OUT") return null;

  return (
    <div className="bg-ink2/40 border border-cream/10 rounded-xl p-5">
      <p className="eyebrow text-cream/60 mb-2">Rooms &amp; relocation</p>
      <div className="space-y-2">
        {booking.segments.map((segment, i) => (
          <div key={segment.id} className="bg-ink border border-cream/10 rounded-xl p-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-cream">
                {segment.room.name}
                {segment.roomUnit ? ` — ${segment.roomUnit.label}` : " (unassigned)"}
              </span>
              <span className="text-cream/60">฿{Number(segment.totalPrice).toLocaleString("en-US")}</span>
            </div>
            <p className="text-xs text-cream/40 mt-1">{formatDateRange(segment.checkIn, segment.checkOut)}</p>
            <div className="flex items-center flex-wrap gap-3 mt-1">
              {i > 0 && <UndoRelocationButton bookingId={booking.id} splitDate={segment.checkIn} onSaved={() => router.refresh()} />}
              {canManage && <RepriceSegmentButton bookingId={booking.id} segmentId={segment.id} onSaved={() => router.refresh()} />}
            </div>
          </div>
        ))}
      </div>
      <RelocateForm booking={booking} canManage={canManage} onSaved={() => router.refresh()} />
    </div>
  );
}
