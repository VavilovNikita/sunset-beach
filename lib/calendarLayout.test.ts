import { describe, expect, it } from "vitest";
import { dateOnlyUTC, toDateKey } from "./bookings";
import {
  buildDayColumns,
  isSameUTCDate,
  columnSpan,
  mergeBlocksByUnit,
  assignLanes,
  groupBookingsByUnit,
} from "./calendarLayout";
import type { RoomUnitBlock, CalendarBooking } from "./types";

function block(overrides: Partial<RoomUnitBlock>): RoomUnitBlock {
  return {
    id: overrides.id ?? "block-1",
    roomUnitId: "unit-1",
    fromDate: "2026-06-10",
    toDate: "2026-06-12",
    reason: "maintenance",
    createdAt: "2026-06-01T00:00:00.000Z",
    ...overrides,
  };
}

function booking(overrides: Partial<CalendarBooking>): CalendarBooking {
  return {
    segmentId: overrides.bookingId ?? "booking-1",
    bookingId: overrides.bookingId ?? "booking-1",
    roomId: "room-1",
    roomUnitId: "unit-1",
    guestName: "Test Guest",
    checkIn: "2026-06-10",
    checkOut: "2026-06-12",
    status: "CONFIRMED",
    totalPrice: "1000.00",
    segmentCount: 1,
    ...overrides,
  };
}

describe("buildDayColumns", () => {
  it("returns one column per day in the half-open range", () => {
    const days = buildDayColumns("2026-06-10", "2026-06-13");
    expect(days.map(toDateKey)).toEqual(["2026-06-10", "2026-06-11", "2026-06-12"]);
  });

  it("is empty when from equals to", () => {
    expect(buildDayColumns("2026-06-10", "2026-06-10")).toEqual([]);
  });

  it("spans a month boundary", () => {
    const days = buildDayColumns("2026-01-30", "2026-02-02");
    expect(days.map(toDateKey)).toEqual(["2026-01-30", "2026-01-31", "2026-02-01"]);
  });
});

describe("isSameUTCDate", () => {
  it("is true for the same calendar day", () => {
    expect(isSameUTCDate(dateOnlyUTC("2026-06-10"), dateOnlyUTC("2026-06-10"))).toBe(true);
  });

  it("is false for different days", () => {
    expect(isSameUTCDate(dateOnlyUTC("2026-06-10"), dateOnlyUTC("2026-06-11"))).toBe(false);
  });
});

describe("columnSpan", () => {
  const gridFrom = dateOnlyUTC("2026-06-01");
  const gridDayCount = 30; // June

  it("computes a normal in-bounds span", () => {
    const { startCol, colSpan: span } = columnSpan(dateOnlyUTC("2026-06-10"), dateOnlyUTC("2026-06-13"), gridFrom, gridDayCount);
    expect(startCol).toBe(9);
    expect(span).toBe(3);
  });

  it("clips a range that starts before the grid's visible start", () => {
    const { startCol, colSpan: span } = columnSpan(dateOnlyUTC("2026-05-25"), dateOnlyUTC("2026-06-05"), gridFrom, gridDayCount);
    expect(startCol).toBe(0);
    // Visible portion is [06-01, 06-05) = 4 days (01, 02, 03, 04) - the clipped-off May days
    // don't count.
    expect(span).toBe(4);
  });

  it("clips a range that ends after the grid's visible end", () => {
    const { startCol, colSpan: span } = columnSpan(dateOnlyUTC("2026-06-25"), dateOnlyUTC("2026-07-05"), gridFrom, gridDayCount);
    expect(startCol).toBe(24);
    expect(span).toBe(6);
  });

  it("is a zero-width span for a range entirely before the grid", () => {
    const { colSpan: span } = columnSpan(dateOnlyUTC("2026-05-01"), dateOnlyUTC("2026-05-10"), gridFrom, gridDayCount);
    expect(span).toBe(0);
  });

  it("is a zero-width span for a range entirely after the grid", () => {
    const { colSpan: span } = columnSpan(dateOnlyUTC("2026-08-01"), dateOnlyUTC("2026-08-10"), gridFrom, gridDayCount);
    expect(span).toBe(0);
  });
});

describe("mergeBlocksByUnit", () => {
  it("keeps a single block as its own segment", () => {
    const result = mergeBlocksByUnit([block({ id: "b1" })]);
    const segments = result.get("unit-1")!;
    expect(segments).toHaveLength(1);
    expect(toDateKey(segments[0].fromDate)).toBe("2026-06-10");
    expect(toDateKey(segments[0].toDate)).toBe("2026-06-12");
    expect(segments[0].reasons).toEqual(["maintenance"]);
  });

  it("merges overlapping blocks on the same unit into one segment", () => {
    const result = mergeBlocksByUnit([
      block({ id: "b1", fromDate: "2026-06-10", toDate: "2026-06-15", reason: "leak" }),
      block({ id: "b2", fromDate: "2026-06-12", toDate: "2026-06-20", reason: "repainting" }),
    ]);
    const segments = result.get("unit-1")!;
    expect(segments).toHaveLength(1);
    expect(toDateKey(segments[0].fromDate)).toBe("2026-06-10");
    expect(toDateKey(segments[0].toDate)).toBe("2026-06-20");
    expect(segments[0].reasons).toEqual(["leak", "repainting"]);
  });

  it("merges blocks that touch with no gap (adjacent)", () => {
    const result = mergeBlocksByUnit([
      block({ id: "b1", fromDate: "2026-06-10", toDate: "2026-06-12", reason: "leak" }),
      block({ id: "b2", fromDate: "2026-06-13", toDate: "2026-06-15", reason: "repainting" }),
    ]);
    const segments = result.get("unit-1")!;
    expect(segments).toHaveLength(1);
    expect(toDateKey(segments[0].toDate)).toBe("2026-06-15");
  });

  it("does not merge blocks with a real gap between them", () => {
    const result = mergeBlocksByUnit([
      block({ id: "b1", fromDate: "2026-06-10", toDate: "2026-06-12", reason: "leak" }),
      block({ id: "b2", fromDate: "2026-06-20", toDate: "2026-06-22", reason: "repainting" }),
    ]);
    const segments = result.get("unit-1")!;
    expect(segments).toHaveLength(2);
  });

  it("keeps blocks on different units in separate entries", () => {
    const result = mergeBlocksByUnit([
      block({ id: "b1", roomUnitId: "unit-1" }),
      block({ id: "b2", roomUnitId: "unit-2" }),
    ]);
    expect(result.get("unit-1")).toHaveLength(1);
    expect(result.get("unit-2")).toHaveLength(1);
  });

  it("doesn't duplicate the same reason twice on a merged segment", () => {
    const result = mergeBlocksByUnit([
      block({ id: "b1", fromDate: "2026-06-10", toDate: "2026-06-15", reason: "leak" }),
      block({ id: "b2", fromDate: "2026-06-12", toDate: "2026-06-20", reason: "leak" }),
    ]);
    expect(result.get("unit-1")![0].reasons).toEqual(["leak"]);
  });
});

describe("assignLanes", () => {
  it("puts non-overlapping bookings on the same room all in lane 0", () => {
    const { lanes, laneCount } = assignLanes([
      booking({ bookingId: "b1", checkIn: "2026-06-01", checkOut: "2026-06-05" }),
      booking({ bookingId: "b2", checkIn: "2026-06-05", checkOut: "2026-06-10" }),
    ]);
    expect(laneCount).toBe(1);
    expect(lanes.every((l) => l.lane === 0)).toBe(true);
  });

  // Half-open stay window: a booking checking in exactly on another's checkout day is not an
  // overlap and must share the same lane, not be pushed to a new one.
  it("treats checkout day as free for the next booking (no false overlap)", () => {
    const { laneCount } = assignLanes([
      booking({ bookingId: "b1", checkIn: "2026-06-01", checkOut: "2026-06-05" }),
      booking({ bookingId: "b2", checkIn: "2026-06-05", checkOut: "2026-06-08" }),
    ]);
    expect(laneCount).toBe(1);
  });

  it("puts two genuinely overlapping bookings in different lanes", () => {
    const { lanes, laneCount } = assignLanes([
      booking({ bookingId: "b1", checkIn: "2026-06-01", checkOut: "2026-06-10" }),
      booking({ bookingId: "b2", checkIn: "2026-06-05", checkOut: "2026-06-15" }),
    ]);
    expect(laneCount).toBe(2);
    const laneByBooking = new Map(lanes.map((l) => [l.booking.bookingId, l.lane]));
    expect(laneByBooking.get("b1")).not.toBe(laneByBooking.get("b2"));
  });

  it("needs three lanes when three bookings all overlap each other", () => {
    const { laneCount } = assignLanes([
      booking({ bookingId: "b1", checkIn: "2026-06-01", checkOut: "2026-06-20" }),
      booking({ bookingId: "b2", checkIn: "2026-06-05", checkOut: "2026-06-15" }),
      booking({ bookingId: "b3", checkIn: "2026-06-08", checkOut: "2026-06-12" }),
    ]);
    expect(laneCount).toBe(3);
  });

  it("reuses a lane once it frees up instead of growing forever", () => {
    const { laneCount } = assignLanes([
      booking({ bookingId: "b1", checkIn: "2026-06-01", checkOut: "2026-06-05" }),
      booking({ bookingId: "b2", checkIn: "2026-06-02", checkOut: "2026-06-06" }), // overlaps b1 -> lane 1
      booking({ bookingId: "b3", checkIn: "2026-06-06", checkOut: "2026-06-10" }), // b1's lane is free again
    ]);
    expect(laneCount).toBe(2);
  });
});

describe("groupBookingsByUnit", () => {
  it("groups bookings by their roomUnitId", () => {
    const result = groupBookingsByUnit([
      booking({ bookingId: "b1", roomUnitId: "unit-1" }),
      booking({ bookingId: "b2", roomUnitId: "unit-1" }),
      booking({ bookingId: "b3", roomUnitId: "unit-2" }),
    ]);
    expect(result.get("unit-1")).toHaveLength(2);
    expect(result.get("unit-2")).toHaveLength(1);
  });

  it("buckets a booking with no assigned unit under the empty-string key", () => {
    const result = groupBookingsByUnit([booking({ bookingId: "b1", roomUnitId: null })]);
    expect(result.get("")).toHaveLength(1);
  });
});
