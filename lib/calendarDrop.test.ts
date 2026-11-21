import { describe, expect, it } from "vitest";
import { dropOutcomeMessage, findClash, findOccupant, grabDayOffset, isSwapPartner } from "./calendarDrop";

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

describe("dropOutcomeMessage", () => {
  it("names both guests when a swap is refused for different room types", () => {
    expect(dropOutcomeMessage("swap-other-type", "Anna", "Boris")).toContain("Anna and Boris are in different room types");
  });

  it("says nothing was changed for a drop between rooms, and tells what to do instead", () => {
    const text = dropOutcomeMessage("missed", "Anna");
    expect(text).toContain("Nothing was changed");
    expect(text).toContain("swap");
  });

  it("has a sentence for every outcome - a drop never ends in nothing", () => {
    for (const kind of ["gone", "swap-other-type", "missed"] as const) {
      expect(dropOutcomeMessage(kind, "Anna", "Boris").length).toBeGreaterThan(20);
    }
  });
});

describe("findOccupant", () => {
  const bars = [
    { bookingId: "b1", segmentId: "s1", roomId: "r", roomUnitId: "u101", guestName: "D", checkIn: "2026-12-01", checkOut: "2026-12-03" },
    { bookingId: "b2", segmentId: "s2", roomId: "r", roomUnitId: "u103", guestName: "E", checkIn: "2026-12-01", checkOut: "2026-12-03" },
  ];

  it("finds the booking on that night of that room - also when the dragged bar has the same dates", () => {
    expect(findOccupant(bars, "u101", "2026-12-02", "s2")?.guestName).toBe("D");
  });

  it("treats the departure day as free and ignores the dragged segment and an unassigned row", () => {
    expect(findOccupant(bars, "u101", "2026-12-03", "s2")).toBeUndefined();
    expect(findOccupant(bars, "u101", "2026-12-02", "s1")).toBeUndefined();
    expect(findOccupant(bars, "", "2026-12-02", "s2")).toBeUndefined();
  });
});
