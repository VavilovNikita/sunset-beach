import { describe, expect, it } from "vitest";
import { computeRoomStats } from "./adminStats";
import type { Booking, Room } from "./types";

const NOW = new Date(Date.UTC(2026, 5, 15, 10, 0, 0)); // 2026-06-15, mid-month

function room(overrides: Partial<Room>): Room {
  return {
    id: overrides.id ?? "room-1",
    name: "Standard Room",
    description: "",
    capacity: 2,
    activeUnitCount: 5,
    basePrice: "1000.00",
    images: [],
    createdAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function booking(overrides: Partial<Booking>): Booking {
  return {
    id: overrides.id ?? "booking-1",
    roomId: "room-1",
    room: room({}),
    roomUnitId: null,
    roomUnit: null,
    guestName: "Test Guest",
    guestEmail: "",
    guestPhone: "",
    checkIn: "2026-06-15",
    checkOut: "2026-06-18",
    totalPrice: "3000.00",
    status: "CONFIRMED",
    paymentNote: null,
    occupancyStatus: "EXPECTED",
    checkedInAt: null,
    checkedOutAt: null,
    segments: [],
    createdAt: "2026-06-15T09:00:00.000Z",
    updatedAt: "2026-06-15T09:00:00.000Z",
    ...overrides,
  };
}

describe("computeRoomStats", () => {
  it("counts a booking created today toward bookingsToday and bookingsThisWeek", () => {
    const stats = computeRoomStats(NOW, [], [booking({ createdAt: "2026-06-15T08:00:00.000Z" })]);
    expect(stats.bookingsToday).toBe(1);
    expect(stats.bookingsThisWeek).toBe(1);
  });

  it("does not count a booking created yesterday toward bookingsToday", () => {
    const stats = computeRoomStats(NOW, [], [booking({ createdAt: "2026-06-14T08:00:00.000Z" })]);
    expect(stats.bookingsToday).toBe(0);
    expect(stats.bookingsThisWeek).toBe(1); // still within the rolling 7-day window
  });

  it("does not count a booking created 8 days ago toward bookingsThisWeek", () => {
    const stats = computeRoomStats(NOW, [], [booking({ createdAt: "2026-06-07T08:00:00.000Z" })]);
    expect(stats.bookingsThisWeek).toBe(0);
  });

  it("does not count a booking created tomorrow (clock skew guard) toward either", () => {
    const stats = computeRoomStats(NOW, [], [booking({ createdAt: "2026-06-16T00:00:01.000Z" })]);
    expect(stats.bookingsToday).toBe(0);
    expect(stats.bookingsThisWeek).toBe(0);
  });

  it("sums totalPrice for PAID bookings checking in this month into revenueThisMonth", () => {
    const stats = computeRoomStats(NOW, [], [
      booking({ id: "b1", status: "PAID", checkIn: "2026-06-05", totalPrice: "1500.00" }),
      booking({ id: "b2", status: "PAID", checkIn: "2026-06-25", totalPrice: "2500.00" }),
    ]);
    expect(stats.revenueThisMonth).toBe(4000);
  });

  it("excludes a PAID booking checking in next month from revenueThisMonth", () => {
    const stats = computeRoomStats(NOW, [], [booking({ status: "PAID", checkIn: "2026-07-01", totalPrice: "1500.00" })]);
    expect(stats.revenueThisMonth).toBe(0);
  });

  it("excludes a PAID booking checking in last month from revenueThisMonth", () => {
    const stats = computeRoomStats(NOW, [], [booking({ status: "PAID", checkIn: "2026-05-31", totalPrice: "1500.00" })]);
    expect(stats.revenueThisMonth).toBe(0);
  });

  it("does not count a CONFIRMED (not yet PAID) booking toward revenue", () => {
    const stats = computeRoomStats(NOW, [], [booking({ status: "CONFIRMED", checkIn: "2026-06-10", totalPrice: "1500.00" })]);
    expect(stats.revenueThisMonth).toBe(0);
  });

  it("includes the last day of the month in revenueThisMonth", () => {
    // Regression guard for an off-by-one at the month boundary specifically, not just "some
    // day in the month" - endOfMonthUTC/nextMonthStart is where that kind of bug hides.
    const stats = computeRoomStats(NOW, [], [booking({ status: "PAID", checkIn: "2026-06-30", totalPrice: "999.00" })]);
    expect(stats.revenueThisMonth).toBe(999);
  });

  it("computes occupancy from booked nights within the 30-day window over total active units", () => {
    const stats = computeRoomStats(
      NOW,
      [room({ id: "r1", activeUnitCount: 2 })],
      // 3 nights booked out of 2 units * 30-day window = 60 room-nights -> 5%
      [booking({ checkIn: "2026-06-15", checkOut: "2026-06-18" })]
    );
    expect(stats.occupancyPct).toBe(5); // round(3/60 * 100) = 5
  });

  it("excludes a CANCELLED booking from occupancy", () => {
    const stats = computeRoomStats(NOW, [room({ activeUnitCount: 2 })], [
      booking({ status: "CANCELLED", checkIn: "2026-06-15", checkOut: "2026-06-18" }),
    ]);
    expect(stats.occupancyPct).toBe(0);
  });

  it("excludes a stay that has already checked out before today from occupancy", () => {
    const stats = computeRoomStats(NOW, [room({ activeUnitCount: 2 })], [
      booking({ checkIn: "2026-06-01", checkOut: "2026-06-05" }),
    ]);
    expect(stats.occupancyPct).toBe(0);
  });

  it("clips a stay that started before today to only count nights from today onward", () => {
    // Checked in 5 days ago, checks out in 3 days: only the remaining 3 nights (today + 2) fall
    // inside the occupancy window, not all 8.
    const stats = computeRoomStats(NOW, [room({ activeUnitCount: 1 })], [
      booking({ checkIn: "2026-06-10", checkOut: "2026-06-18" }),
    ]);
    // 3 nights (06-15, 06-16, 06-17) out of 1 unit * 30 = 30 -> 10%
    expect(stats.occupancyPct).toBe(10);
  });

  it("clips a stay extending past the occupancy window to the window's edge", () => {
    const stats = computeRoomStats(NOW, [room({ activeUnitCount: 1 })], [
      booking({ checkIn: "2026-06-01", checkOut: "2026-12-01" }), // far past the 30-day window
    ]);
    // Full 30-day window booked, 1 unit -> 100%
    expect(stats.occupancyPct).toBe(100);
  });

  it("is 0% occupancy when there are no active units, not a division error", () => {
    const stats = computeRoomStats(NOW, [], [booking({ checkIn: "2026-06-15", checkOut: "2026-06-18" })]);
    expect(stats.occupancyPct).toBe(0);
    expect(Number.isFinite(stats.occupancyPct)).toBe(true);
  });

  it("sums activeUnitCount across multiple room types for the occupancy denominator", () => {
    const stats = computeRoomStats(
      NOW,
      [room({ id: "r1", activeUnitCount: 2 }), room({ id: "r2", activeUnitCount: 3 })],
      [booking({ checkIn: "2026-06-15", checkOut: "2026-06-18" })]
    );
    // 3 nights / (5 units * 30) = 150 -> 2%
    expect(stats.occupancyPct).toBe(2);
  });
});
