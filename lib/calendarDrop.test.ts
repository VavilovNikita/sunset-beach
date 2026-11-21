import { describe, expect, it } from "vitest";
import { findClash, grabDayOffset, isSwapPartner } from "./calendarDrop";

describe("isSwapPartner", () => {
  it("is true for a booking in another room", () => {
    expect(isSwapPartner({ bookingId: "b2", roomUnitId: "u102" }, "b1", "u101")).toBe(true);
  });

  it("is false for a booking in the SAME room - that drop is a date shift, never a 101 -> 101 swap", () => {
    expect(isSwapPartner({ bookingId: "b2", roomUnitId: "u101" }, "b1", "u101")).toBe(false);
  });

  it("is false for the dragged booking itself, for no bar, and when the dragged booking has no room yet", () => {
    expect(isSwapPartner({ bookingId: "b1", roomUnitId: "u102" }, "b1", "u101")).toBe(false);
    expect(isSwapPartner(null, "b1", "u101")).toBe(false);
    expect(isSwapPartner({ bookingId: "b2", roomUnitId: "u102" }, "b1", "")).toBe(false);
  });
});

describe("findClash", () => {
  const bookings = [
    { bookingId: "b1", roomUnitId: "u101", checkIn: "2026-10-01", checkOut: "2026-10-04" },
    { bookingId: "b2", roomUnitId: "u101", checkIn: "2026-10-05", checkOut: "2026-10-08" },
    { bookingId: "b3", roomUnitId: "u102", checkIn: "2026-10-01", checkOut: "2026-10-10" },
  ];

  it("finds the booking that holds a night of the new range in that room", () => {
    expect(findClash(bookings, "b1", "u101", "2026-10-03", "2026-10-06")?.bookingId).toBe("b2");
  });

  it("allows back-to-back stays: the departure day is free", () => {
    expect(findClash(bookings, "b1", "u101", "2026-10-04", "2026-10-05")).toBeUndefined();
  });

  it("ignores the booking being moved, other rooms and an unassigned target", () => {
    expect(findClash(bookings, "b1", "u101", "2026-10-02", "2026-10-03")).toBeUndefined();
    expect(findClash(bookings, "b1", "u102", "2026-10-11", "2026-10-12")).toBeUndefined();
    expect(findClash(bookings, "b1", null, "2026-10-01", "2026-10-10")).toBeUndefined();
  });
});

describe("grabDayOffset", () => {
  it("counts from the bar's left edge when the whole stay is on screen", () => {
    expect(grabDayOffset(120, 100, 88, "2026-11-22", "2026-11-21")).toBe(0);
    expect(grabDayOffset(300, 100, 88, "2026-11-22", "2026-11-21")).toBe(2);
  });

  it("adds the days of a stay that began before the first visible day - the bar is clipped there", () => {
    // Checked in on the 19th, the grid opens on the 21st: grabbing the first visible column is day 2 of the stay.
    expect(grabDayOffset(120, 100, 88, "2026-11-19", "2026-11-21")).toBe(2);
    expect(grabDayOffset(300, 100, 88, "2026-11-19", "2026-11-21")).toBe(4);
  });
});
