import { describe, expect, it } from "vitest";
import { bulkTargets, canChangeStatus, filterBoardRooms, roomTypesOf, splitArrivals } from "@/lib/housekeepingFilter";
import type { HousekeepingRoom } from "@/lib/types";

function room(id: string, over: Partial<HousekeepingRoom> = {}): HousekeepingRoom {
  return {
    roomUnitId: id,
    roomId: "r1",
    roomName: "Deluxe",
    unitLabel: id,
    isActive: true,
    housekeepingStatus: "CLEAN",
    occupied: false,
    arrivingToday: false,
    departingToday: false,
    overdueDays: 0,
    outOfOrder: false,
    ...over,
  };
}
const ids = (rooms: HousekeepingRoom[]) => rooms.map((r) => r.roomUnitId);

describe("housekeeping board", () => {
  it("a deactivated room takes no action", () => {
    expect(canChangeStatus(room("a", { isActive: false }))).toBe(false);
    expect(bulkTargets([room("a", { isActive: false })], new Set(["a"]), "DIRTY")).toEqual([]);
  });

  it("filters by status code and room type", () => {
    const rooms = [room("a", { housekeepingStatus: "DIRTY" }), room("b", { roomId: "r2" }), room("c", { occupied: true, housekeepingStatus: "DIRTY" })];
    expect(ids(filterBoardRooms(rooms, "VD", "ALL"))).toEqual(["a"]);
    expect(ids(filterBoardRooms(rooms, "ALL", "r2"))).toEqual(["b"]);
    expect(ids(filterBoardRooms(rooms, "NEEDS_CLEANING", "ALL"))).toEqual(["a", "c"]);
  });

  it("puts arrivals today first, dirty ones before clean ones - an occupied turnover room among them", () => {
    const rooms = [
      room("c", { arrivingToday: true }),
      room("d", { arrivingToday: true, occupied: true, departingToday: true, housekeepingStatus: "DIRTY" }),
      room("e"),
    ];
    const { arriving, rest } = splitArrivals(rooms);
    expect(ids(arriving)).toEqual(["d", "c"]);
    expect(ids(rest)).toEqual(["e"]);
  });

  it("lists each room type once, by name", () => {
    const rooms = [room("a", { roomId: "r2", roomName: "Standard" }), room("b"), room("c")];
    expect(roomTypesOf(rooms)).toEqual([
      { id: "r1", name: "Deluxe" },
      { id: "r2", name: "Standard" },
    ]);
  });

  it("bulk skips rooms already in the wanted state", () => {
    const rooms = [room("a", { housekeepingStatus: "DIRTY" }), room("b")];
    expect(ids(bulkTargets(rooms, new Set(["a", "b"]), "CLEAN"))).toEqual(["a"]);
  });
});
