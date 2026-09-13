import { describe, expect, it } from "vitest";
import { resolveSpaTableFill } from "./spaMapDisplay";
import type { SpaMapTable } from "@/lib/posTypes";

function table(overrides: Partial<SpaMapTable>): SpaMapTable {
  return {
    tableId: "table-1",
    label: "1",
    capacity: 1,
    isActive: true,
    positionX: null,
    positionY: null,
    busy: false,
    nextAppointmentStartTime: null,
    appointments: [],
    ...overrides,
  };
}

describe("resolveSpaTableFill", () => {
  it("is free when active and not busy", () => {
    expect(resolveSpaTableFill(table({}))).toBe("free");
  });

  it("is busy when an appointment covers this moment", () => {
    expect(resolveSpaTableFill(table({ busy: true }))).toBe("busy");
  });

  it("is inactive when deactivated, regardless of busy", () => {
    expect(resolveSpaTableFill(table({ isActive: false, busy: true }))).toBe("inactive");
    expect(resolveSpaTableFill(table({ isActive: false, busy: false }))).toBe("inactive");
  });
});
