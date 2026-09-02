import { describe, expect, it } from "vitest";
import { resolveUnitDisplay } from "./propertyMapDisplay";
import type { PropertyMapUnit } from "./types";

const TODAY = "2026-09-02";

function unit(overrides: Partial<PropertyMapUnit> = {}): PropertyMapUnit {
  return {
    roomUnitId: "unit-1",
    roomId: "room-1",
    roomName: "Ocean View Suite",
    unitLabel: "203",
    isActive: true,
    housekeepingStatus: "CLEAN",
    positionX: 0.5,
    positionY: 0.5,
    currentBooking: null,
    activeBlock: null,
    ...overrides,
  };
}

describe("resolveUnitDisplay — base fill", () => {
  it("a vacant, active, unblocked room is the one 'pop' color: vacant", () => {
    expect(resolveUnitDisplay(unit(), TODAY).fill).toBe("vacant");
  });

  it("a checked-in guest reads as occupied", () => {
    const u = unit({
      currentBooking: { bookingId: "b1", guestName: "Somchai", checkOut: "2026-09-05", occupancyStatus: "CHECKED_IN", outstandingBalance: "0.00" },
    });
    expect(resolveUnitDisplay(u, TODAY).fill).toBe("occupied");
  });

  it("a today-covering block on an otherwise-vacant room reads as blocked, not vacant", () => {
    const u = unit({ activeBlock: { reason: "AC is leaking", fromDate: "2026-09-01", toDate: "2026-09-04" } });
    expect(resolveUnitDisplay(u, TODAY).fill).toBe("blocked");
  });

  it("a permanently deactivated room reads as inactive, regardless of anything else", () => {
    const u = unit({ isActive: false });
    expect(resolveUnitDisplay(u, TODAY).fill).toBe("inactive");
  });

  // The bug caught in plan review: isActive and a today-block are independent facts, not the
  // same "unavailable" flag - deactivation must not be confused with a temporary block.
  it("deactivated AND blocked at once: deactivation wins the fill, and the block is suppressed entirely", () => {
    const u = unit({ isActive: false, activeBlock: { reason: "Flooded", fromDate: "2026-09-02", toDate: "2026-09-02" } });
    const result = resolveUnitDisplay(u, TODAY);
    expect(result.fill).toBe("inactive");
    expect(result.badges).toEqual([]);
  });

  it("checked-in AND blocked at once (rare overlap): the real guest wins the fill, but a badge still flags the block", () => {
    const u = unit({
      currentBooking: { bookingId: "b1", guestName: "Somchai", checkOut: "2026-09-05", occupancyStatus: "CHECKED_IN", outstandingBalance: "0.00" },
      activeBlock: { reason: "Scheduled repaint", fromDate: "2026-09-02", toDate: "2026-09-03" },
    });
    const result = resolveUnitDisplay(u, TODAY);
    expect(result.fill).toBe("occupied");
    expect(result.badges).toContain("blocked-while-occupied");
  });

  it("a deactivated room ignores housekeeping/debt/booking entirely for the fill - never sea, never the occupied tone", () => {
    const u = unit({
      isActive: false,
      housekeepingStatus: "DIRTY",
      currentBooking: { bookingId: "b1", guestName: "Guest", checkOut: TODAY, occupancyStatus: "CHECKED_IN", outstandingBalance: "500.00" },
    });
    const result = resolveUnitDisplay(u, TODAY);
    expect(result.fill).toBe("inactive");
    expect(result.badges).toEqual([]);
  });
});

describe("resolveUnitDisplay — badges and their priority", () => {
  it("a clean, settled, checked-in guest gets no badges at all", () => {
    const u = unit({
      currentBooking: { bookingId: "b1", guestName: "Guest", checkOut: "2026-09-05", occupancyStatus: "CHECKED_IN", outstandingBalance: "0.00" },
    });
    expect(resolveUnitDisplay(u, TODAY).badges).toEqual([]);
  });

  it("an outstanding balance on an occupied room shows a debt badge", () => {
    const u = unit({
      currentBooking: { bookingId: "b1", guestName: "Guest", checkOut: "2026-09-05", occupancyStatus: "CHECKED_IN", outstandingBalance: "350.00" },
    });
    expect(resolveUnitDisplay(u, TODAY).badges).toEqual(["debt"]);
  });

  it("a dirty vacant room shows a dirty badge even though the tile is unoccupied", () => {
    const u = unit({ housekeepingStatus: "DIRTY" });
    expect(resolveUnitDisplay(u, TODAY).badges).toEqual(["dirty"]);
  });

  // The exact combination named in the spec: occupied + not cleaned + departing today.
  it("occupied, dirty, departing today: dirty outranks the timing badge (no debt here)", () => {
    const u = unit({
      housekeepingStatus: "DIRTY",
      currentBooking: { bookingId: "b1", guestName: "Guest", checkOut: TODAY, occupancyStatus: "CHECKED_IN", outstandingBalance: "0.00" },
    });
    expect(resolveUnitDisplay(u, TODAY).badges).toEqual(["dirty", "departing-today"]);
  });

  it("debt outranks dirty when both are true", () => {
    const u = unit({
      housekeepingStatus: "DIRTY",
      currentBooking: { bookingId: "b1", guestName: "Guest", checkOut: "2026-09-05", occupancyStatus: "CHECKED_IN", outstandingBalance: "200.00" },
    });
    expect(resolveUnitDisplay(u, TODAY).badges).toEqual(["debt", "dirty"]);
  });

  it("a guest expected to check in today (not yet checked in) shows an arriving badge, fill stays vacant", () => {
    const u = unit({
      currentBooking: { bookingId: "b2", guestName: "Guest", checkOut: "2026-09-06", occupancyStatus: "EXPECTED", outstandingBalance: "0.00" },
    });
    const result = resolveUnitDisplay(u, TODAY);
    expect(result.fill).toBe("vacant");
    expect(result.badges).toEqual(["arriving-today"]);
  });

  it("checkOut not today does not trigger the departing badge", () => {
    const u = unit({
      currentBooking: { bookingId: "b1", guestName: "Guest", checkOut: "2026-09-08", occupancyStatus: "CHECKED_IN", outstandingBalance: "0.00" },
    });
    expect(resolveUnitDisplay(u, TODAY).badges).toEqual([]);
  });
});
