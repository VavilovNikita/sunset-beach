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

// The segment the stay is in today - the server's answer (Booking.currentSegmentId), never worked out from dates here.
// Undefined only for a payload without it; callers then fall back to the booking's own (last) room.
export function currentSegment(booking: Pick<Booking, "segments" | "currentSegmentId">): BookingSegment | undefined {
  return booking.segments.find((s) => s.id === booking.currentSegmentId);
}

// The segment holding the night of `date` (YYYY-MM-DD), for a picker that books something on another day; outside the
// stay the nearest one - the last from the departure day on. The server's rule (OverstayRule#currentSegment), which it
// sends only for today (currentSegmentId). Segments arrive ordered by check-in.
export function segmentOn(booking: Pick<Booking, "segments">, date: string): BookingSegment | undefined {
  const { segments } = booking;
  const holding = segments.find((s) => s.checkIn <= date && date < s.checkOut);
  if (holding) return holding;
  return segments.length > 0 && date < segments[0].checkIn ? segments[0] : segments[segments.length - 1];
}

// "Deluxe Suite" and its room for the night of `date`: the unit falls back to the booking's own, as the server's does.
export function roomOn(booking: Pick<Booking, "segments" | "room" | "roomUnit">, date: string) {
  const segment = segmentOn(booking, date);
  return { typeName: segment?.room.name ?? booking.room.name, unitLabel: (segment?.roomUnit ?? booking.roomUnit)?.label ?? null };
}

// The physical room the guest is in today, null when that segment has none assigned. What tells two guests in the same
// room type apart, e.g. in the POS "Charge to room" picker. Booking.roomUnit is the LAST segment's room.
export function currentRoomUnit(booking: Pick<Booking, "segments" | "roomUnit" | "currentSegmentId">) {
  const segment = currentSegment(booking);
  return segment ? segment.roomUnit : booking.roomUnit;
}

export function currentRoomUnitLabel(booking: Pick<Booking, "segments" | "roomUnit" | "currentSegmentId">): string | null {
  return currentRoomUnit(booking)?.label ?? null;
}
