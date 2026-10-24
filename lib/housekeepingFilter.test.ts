import { describe, expect, it } from "vitest";
import { bulkTargets, canChangeStatus, filterBoardUnits, splitArrivals, type BoardUnit } from "@/lib/housekeepingFilter";
import type { HousekeepingRoomStatus } from "@/lib/housekeepingCode";
import type { RoomUnit } from "@/lib/types";

function unit(id: string, over: Partial<RoomUnit> = {}): RoomUnit {
  return { id, roomId: "r1", label: id, isActive: true, housekeepingStatus: "CLEAN", positionX: null, positionY: null, createdAt: "", ...over };
}
const status = (over: Partial<HousekeepingRoomStatus> = {}): HousekeepingRoomStatus => ({
  code: "VC",
  occupied: false,
  arrivingToday: false,
  departingToday: false,
  overdueDays: 0,
  outOfOrder: false,
  ...over,
});
const item = (u: RoomUnit, s: HousekeepingRoomStatus | null = null): BoardUnit => ({ unit: u, status: s });

describe("housekeeping board", () => {
  it("a deactivated room takes no action", () => {
    expect(canChangeStatus(unit("a", { isActive: false }))).toBe(false);
    expect(bulkTargets([item(unit("a", { isActive: false }))], new Set(["a"]), "DIRTY")).toEqual([]);
  });

  it("filters by status code and room type", () => {
    const items = [item(unit("a", { housekeepingStatus: "DIRTY" }), status({ code: "VD" })), item(unit("b", { roomId: "r2" }), status())];
    expect(filterBoardUnits(items, "VD", "ALL").map((i) => i.unit.id)).toEqual(["a"]);
    expect(filterBoardUnits(items, "ALL", "r2").map((i) => i.unit.id)).toEqual(["b"]);
    expect(filterBoardUnits(items, "NEEDS_CLEANING", "ALL").map((i) => i.unit.id)).toEqual(["a"]);
  });

  it("falls back to clean/dirty when occupancy is unknown", () => {
    const items = [item(unit("a", { housekeepingStatus: "DIRTY" })), item(unit("b"))];
    expect(filterBoardUnits(items, "VD", "ALL").map((i) => i.unit.id)).toEqual(["a"]);
    expect(filterBoardUnits(items, "VC", "ALL").map((i) => i.unit.id)).toEqual(["b"]);
  });

  it("puts arrivals today first, dirty ones before clean ones", () => {
    const items = [
      item(unit("c"), status({ arrivingToday: true })),
      item(unit("d", { housekeepingStatus: "DIRTY" }), status({ arrivingToday: true, code: "VD" })),
      item(unit("e")),
    ];
    const { arriving, rest } = splitArrivals(items);
    expect(arriving.map((i) => i.unit.id)).toEqual(["d", "c"]);
    expect(rest.map((i) => i.unit.id)).toEqual(["e"]);
  });

  it("bulk skips rooms already in the wanted state", () => {
    const items = [item(unit("a", { housekeepingStatus: "DIRTY" })), item(unit("b"))];
    expect(bulkTargets(items, new Set(["a", "b"]), "CLEAN").map((u) => u.id)).toEqual(["a"]);
  });
});
