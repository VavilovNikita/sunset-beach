import { describe, expect, it } from "vitest";
import { currentRoomUnitLabel, roomStops, roomTypeSummary, roomUnitSummary, roomOn } from "@/lib/bookingRooms";
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

describe("currentRoomUnitLabel", () => {
  const inSegment = (n: number) => ({ ...test1, currentSegmentId: test1.segments[n].id });

  it("is the room of the segment the server says the stay is in", () => {
    expect(currentRoomUnitLabel(inSegment(0))).toBe("201");
    expect(currentRoomUnitLabel(inSegment(1))).toBe("202");
    expect(currentRoomUnitLabel(inSegment(2))).toBe("102");
  });

  it("is not the booking's last room while a later move has not happened", () => {
    expect(test1.roomUnit.label).toBe("102");
    expect(currentRoomUnitLabel(inSegment(0))).toBe("201");
  });

  it("is null when that segment has no room assigned", () => {
    const unassigned = segment(deluxe, null, "2026-08-02", "2026-08-06");
    expect(currentRoomUnitLabel({ roomUnit: test1.roomUnit, segments: [unassigned], currentSegmentId: unassigned.id })).toBeNull();
  });

  it("falls back to the booking's room without a current segment", () => {
    expect(currentRoomUnitLabel(test1)).toBe("102");
  });
});

describe("roomOn", () => {
  const stay = {
    room: { name: "Standard" },
    roomUnit: { label: "102" },
    segments: [
      { checkIn: "2033-05-01", checkOut: "2033-05-04", room: { name: "Deluxe" }, roomUnit: { label: "201" } },
      { checkIn: "2033-05-04", checkOut: "2033-05-08", room: { name: "Standard" }, roomUnit: { label: "102" } },
    ],
  } as unknown as Parameters<typeof roomOn>[0];

  it("names the room of that night, the move's own date in the new room", () => {
    expect(roomOn(stay, "2033-05-03")).toEqual({ typeName: "Deluxe", unitLabel: "201" });
    expect(roomOn(stay, "2033-05-04")).toEqual({ typeName: "Standard", unitLabel: "102" });
  });

  it("shows no room for a night without one, whatever the last night has", () => {
    const first = { ...stay.segments[0], roomUnit: null };
    expect(roomOn({ ...stay, segments: [first, stay.segments[1]] }, "2033-05-02")).toEqual({ typeName: "Deluxe", unitLabel: null });
  });

  it("keeps a guest whose new room isn't picked in the room they are still in", () => {
    const old = { ...stay.segments[0], id: "old" };
    const next = { ...stay.segments[1], id: "next", roomUnit: null };
    const moving = { ...stay, segments: [old, next], currentSegmentId: "next", roomSegmentId: "old" };
    expect(roomOn(moving, "2033-05-05")).toEqual({ typeName: "Deluxe", unitLabel: "201" });
    expect(currentRoomUnitLabel(moving)).toBe("201");
  });

  it("takes the nearest night outside the stay", () => {
    expect(roomOn(stay, "2033-04-30").unitLabel).toBe("201");
    expect(roomOn(stay, "2033-05-08").unitLabel).toBe("102");
    expect(roomOn(stay, "2033-05-20").unitLabel).toBe("102");
  });
});
