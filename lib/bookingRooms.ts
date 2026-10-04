import type { Booking, BookingSegment } from "@/lib/types";

// Which room a booking is in, read from its segments - never from Booking.room alone.
//
// Booking.roomId/room is a denormalized mirror of the *last* segment (BookingWriter
// #syncBookingFromSegments on the backend): "where does the guest end up". For a relocated
// booking that is only half the story - test1 started in 201 (Deluxe Suite), moved to 202, and
// ends in 102 (Standard Room), so a "Room: Standard Room" label read as if the whole stay had
// been a Standard. These helpers say the whole thing. Pure, tested in bookingRooms.test.ts.

export type RoomStop = { roomTypeName: string; unitLabels: string[] };

// Consecutive segments in the same room type collapse into one stop (201 → 202 are both Deluxe
// Suite: one stop, two rooms). A never-relocated booking is exactly one stop.
export function roomStops(segments: BookingSegment[]): RoomStop[] {
  const stops: RoomStop[] = [];
  for (const segment of segments) {
    const last = stops[stops.length - 1];
    const label = segment.roomUnit?.label ?? null;
    if (last && last.roomTypeName === segment.room.name) {
      if (label && !last.unitLabels.includes(label)) last.unitLabels.push(label);
    } else {
      stops.push({ roomTypeName: segment.room.name, unitLabels: label ? [label] : [] });
    }
  }
  return stops;
}

// One line for a table cell: "Deluxe Suite" or "Deluxe Suite → Standard Room".
export function roomTypeSummary(booking: Pick<Booking, "segments" | "room">): string {
  if (booking.segments.length === 0) return booking.room.name;
  return roomStops(booking.segments)
    .map((s) => s.roomTypeName)
    .join(" → ");
}

// The physical rooms in stay order: "201 → 202 → 102", or null when none is assigned yet.
export function roomUnitSummary(booking: Pick<Booking, "segments" | "roomUnit">): string | null {
  if (booking.segments.length === 0) return booking.roomUnit?.label ?? null;
  const labels = booking.segments.map((s) => s.roomUnit?.label ?? "unassigned");
  if (labels.every((l) => l === "unassigned")) return null;
  return labels.filter((l, i) => i === 0 || l !== labels[i - 1]).join(" → ");
}

// The physical room the guest is in on `today` (YYYY-MM-DD, hotel date) - the segment covering
// that night, or the last one when no segment does (a guest past checkOut is still in their last
// room - the backend's OverstayRule). null when that segment has no room assigned. What tells two
// guests in the same room type apart, e.g. in the POS "Charge to room" picker.
export function currentRoomUnitLabel(booking: Pick<Booking, "segments" | "roomUnit">, today: string): string | null {
  if (booking.segments.length === 0) return booking.roomUnit?.label ?? null;
  const covering = booking.segments.find((s) => s.checkIn <= today && today < s.checkOut);
  const segment = covering ?? booking.segments[booking.segments.length - 1];
  return segment.roomUnit?.label ?? null;
}
