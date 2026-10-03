import { describe, expect, it } from "vitest";
import { roomStops, roomTypeSummary, roomUnitSummary } from "@/lib/bookingRooms";
import type { BookingSegment, Room, RoomUnit } from "@/lib/types";

const deluxe = { id: "r-deluxe", name: "Deluxe Suite" } as Room;
const standard = { id: "r-standard", name: "Standard Room" } as Room;

function segment(room: Room, unitLabel: string | null, checkIn: string, checkOut: string): BookingSegment {
  return {
    id: `${room.id}-${checkIn}`,
    roomId: room.id,
    room,
    roomUnitId: unitLabel,
    roomUnit: unitLabel ? ({ id: unitLabel, label: unitLabel } as RoomUnit) : null,
    checkIn,
    checkOut,
    totalPrice: "1000.00",
  };
}

// The real test1 booking: 201 (Deluxe) → 202 (Deluxe) → 102 (Standard). Booking.room is the
// last segment's type - Standard Room - which is what the page used to show for the whole stay.
const test1 = {
  room: standard,
  roomUnit: { id: "102", label: "102" } as RoomUnit,
  segments: [
    segment(deluxe, "201", "2026-08-02", "2026-08-06"),
    segment(deluxe, "202", "2026-08-06", "2026-08-07"),
    segment(standard, "102", "2026-08-07", "2026-08-08"),
  ],
};

describe("roomTypeSummary", () => {
  it("names every room type of a relocated stay in order, not just the last one", () => {
    expect(roomTypeSummary(test1)).toBe("Deluxe Suite → Standard Room");
  });

  it("is the one type for a never-relocated booking", () => {
    expect(roomTypeSummary({ room: deluxe, segments: [segment(deluxe, "201", "2026-08-02", "2026-08-06")] })).toBe("Deluxe Suite");
  });
});

describe("roomStops", () => {
  it("collapses consecutive same-type segments into one stop with each room", () => {
    expect(roomStops(test1.segments)).toEqual([
      { roomTypeName: "Deluxe Suite", unitLabels: ["201", "202"] },
      { roomTypeName: "Standard Room", unitLabels: ["102"] },
    ]);
  });
});

describe("roomUnitSummary", () => {
  it("lists the physical rooms in stay order", () => {
    expect(roomUnitSummary(test1)).toBe("201 → 202 → 102");
  });

  it("is null when no room is assigned anywhere", () => {
    expect(roomUnitSummary({ roomUnit: null, segments: [segment(deluxe, null, "2026-08-02", "2026-08-06")] })).toBeNull();
  });

  it("says which leg is still unassigned", () => {
    expect(
      roomUnitSummary({
        roomUnit: null,
        segments: [segment(deluxe, "201", "2026-08-02", "2026-08-06"), segment(standard, null, "2026-08-06", "2026-08-08")],
      })
    ).toBe("201 → unassigned");
  });
});
