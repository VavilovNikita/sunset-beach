import { describe, expect, it } from "vitest";
import { busyUnits, monthsOfRange, movedRange } from "@/lib/relocationUnits";
import type { AvailabilityDay } from "@/lib/types";

const unit = (id: string, over: Partial<AvailabilityDay["units"][number]> = {}): AvailabilityDay["units"][number] => ({
  roomUnitId: id,
  label: id,
  isBlocked: false,
  isBooked: false,
  isAvailable: true,
  bookingId: null,
  blockReason: null,
  ...over,
});
const day = (date: string, units: AvailabilityDay["units"]): AvailabilityDay => ({ date, unitCount: units.length, blockedCount: 0, bookedCount: 0, availableCount: 0, units });

describe("busyUnits", () => {
  it("marks a unit booked by someone else on a night of the range, with the first such night", () => {
    const days = [day("2026-11-22", [unit("a"), unit("b", { isBooked: true, isAvailable: false, bookingId: "x", guestName: "Ann" })]), day("2026-11-23", [unit("a"), unit("b")])];
    const busy = busyUnits(days, "2026-11-22", "2026-11-24", "me");
    expect([...busy.keys()]).toEqual(["b"]);
    expect(busy.get("b")).toBe("booked 22 Nov 2026 (Ann)");
  });

  it("ignores the booking's own nights and nights outside the range", () => {
    const days = [
      day("2026-11-21", [unit("a", { isBooked: true, isAvailable: false, bookingId: "x" })]),
      day("2026-11-22", [unit("b", { isBooked: true, isAvailable: false, bookingId: "me" })]),
      day("2026-11-24", [unit("c", { isBooked: true, isAvailable: false, bookingId: "x" })]),
    ];
    expect(busyUnits(days, "2026-11-22", "2026-11-24", "me").size).toBe(0);
  });

  it("marks a blocked unit with the reason", () => {
    const days = [day("2026-11-22", [unit("a", { isBlocked: true, isAvailable: false, blockReason: "AC" })])];
    expect(busyUnits(days, "2026-11-22", "2026-11-23", "me").get("a")).toBe("out of service 22 Nov 2026 (AC)");
  });
});

describe("movedRange and monthsOfRange", () => {
  const segments = [
    { checkIn: "2026-11-20", checkOut: "2026-11-23" },
    { checkIn: "2026-11-23", checkOut: "2026-12-02" },
  ];
  it("runs to the end of the part of the stay holding the date", () => {
    expect(movedRange(segments, "2026-11-21")).toEqual({ from: "2026-11-21", toExclusive: "2026-11-23" });
    expect(movedRange(segments, "2026-11-25")).toEqual({ from: "2026-11-25", toExclusive: "2026-12-02" });
  });
  it("lists every month touched", () => {
    expect(monthsOfRange("2026-11-25", "2026-12-02")).toEqual(["2026-11", "2026-12"]);
    expect(monthsOfRange("2026-11-25", "2026-12-01")).toEqual(["2026-11"]);
  });
});
