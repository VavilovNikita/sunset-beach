import { describe, expect, it } from "vitest";
import { resolveRestaurantTableAction, resolveRestaurantTableFill } from "./restaurantMapDisplay";
import type { RestaurantMapTable } from "@/lib/posTypes";

function table(overrides: Partial<RestaurantMapTable>): RestaurantMapTable {
  return {
    tableId: "table-1",
    label: "1",
    zone: "RESTAURANT",
    capacity: 4,
    isActive: true,
    positionX: null,
    positionY: null,
    openOrderIds: [],
    ...overrides,
  };
}

describe("resolveRestaurantTableFill", () => {
  it("is free when active with no open order", () => {
    expect(resolveRestaurantTableFill(table({}))).toBe("free");
  });

  it("is busy with an open order", () => {
    expect(resolveRestaurantTableFill(table({ openOrderIds: ["o1"] }))).toBe("busy");
  });

  it("is inactive when deactivated, even with an open order", () => {
    expect(resolveRestaurantTableFill(table({ isActive: false, openOrderIds: ["o1"] }))).toBe("inactive");
  });
});

describe("resolveRestaurantTableAction", () => {
  it("starts a new order on a free active table", () => {
    expect(resolveRestaurantTableAction(table({}))).toEqual({ kind: "start" });
  });

  it("opens the one open order", () => {
    expect(resolveRestaurantTableAction(table({ openOrderIds: ["o1"] }))).toEqual({ kind: "open", orderId: "o1" });
  });

  it("asks which when there are several", () => {
    expect(resolveRestaurantTableAction(table({ openOrderIds: ["o1", "o2"] }))).toEqual({ kind: "pick", orderIds: ["o1", "o2"] });
  });

  it("never starts an order on a deactivated table, but still opens its existing one", () => {
    expect(resolveRestaurantTableAction(table({ isActive: false }))).toEqual({ kind: "none" });
    expect(resolveRestaurantTableAction(table({ isActive: false, openOrderIds: ["o1"] }))).toEqual({ kind: "open", orderId: "o1" });
  });
});
