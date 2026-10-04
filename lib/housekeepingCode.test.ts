import { describe, expect, it } from "vitest";
import { resolveHousekeepingStatus } from "@/lib/housekeepingCode";
import type { PropertyMapUnit } from "@/lib/types";

const TODAY = "2033-05-10";

function unit(overrides: Partial<PropertyMapUnit> = {}): PropertyMapUnit {
  return {
    roomUnitId: "u1",
    roomId: "r1",
    roomName: "Deluxe",
    unitLabel: "101",
    isActive: true,
    housekeepingStatus: "CLEAN",
    positionX: null,
    positionY: null,
    currentBooking: null,
    activeBlock: null,
    openMaintenanceTask: null,
    ...overrides,
  };
}

function booking(occupancyStatus: "EXPECTED" | "CHECKED_IN", checkOut = "2033-05-12") {
  return { bookingId: "b1", guestName: "Guest", checkOut, occupancyStatus, outstandingBalance: "0.00" };
}

describe("resolveHousekeepingStatus", () => {
  it("crosses occupancy with cleaning state", () => {
    expect(resolveHousekeepingStatus("CLEAN", unit(), TODAY)?.code).toBe("VC");
    expect(resolveHousekeepingStatus("DIRTY", unit(), TODAY)?.code).toBe("VD");
    expect(resolveHousekeepingStatus("CLEAN", unit({ currentBooking: booking("CHECKED_IN") }), TODAY)?.code).toBe("OC");
    expect(resolveHousekeepingStatus("DIRTY", unit({ currentBooking: booking("CHECKED_IN") }), TODAY)?.code).toBe("OD");
  });

  it("treats a guest who hasn't arrived yet as vacant, flagged as arriving", () => {
    const status = resolveHousekeepingStatus("CLEAN", unit({ currentBooking: booking("EXPECTED") }), TODAY);
    expect(status?.code).toBe("VC");
    expect(status?.arrivingToday).toBe(true);
  });

  it("says due out today only on the departure date itself", () => {
    expect(resolveHousekeepingStatus("CLEAN", unit({ currentBooking: booking("CHECKED_IN", TODAY) }), TODAY)?.departingToday).toBe(true);
    expect(resolveHousekeepingStatus("CLEAN", unit({ currentBooking: booking("CHECKED_IN") }), TODAY)?.departingToday).toBe(false);
  });

  it("flags a guest past their departure date as overdue, not due out today", () => {
    const status = resolveHousekeepingStatus(
      "CLEAN",
      unit({ currentBooking: { ...booking("CHECKED_IN", "2033-05-08"), overdueDays: 2 } }),
      TODAY,
    );
    expect(status?.departingToday).toBe(false);
    expect(status?.overdueDays).toBe(2);
  });

  it("flags a blocked room as out of order without changing its code", () => {
    const status = resolveHousekeepingStatus("DIRTY", unit({ activeBlock: { reason: "AC", fromDate: TODAY, toDate: TODAY } }), TODAY);
    expect(status?.code).toBe("VD");
    expect(status?.outOfOrder).toBe(true);
  });

  it("returns null when occupancy is unknown, so the board doesn't guess vacant", () => {
    expect(resolveHousekeepingStatus("CLEAN", undefined, TODAY)).toBeNull();
  });
});
