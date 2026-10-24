import type { HousekeepingCode, HousekeepingRoomStatus } from "@/lib/housekeepingCode";
import type { RoomUnit } from "@/lib/types";

// What the Room status board shows for the chosen filters, and in which order. Pure, so the order
// ("arriving today first") and the rule for a room that is out of service are tested rather than eyeballed.

export type StatusFilter = "ALL" | HousekeepingCode | "NEEDS_CLEANING";

export type BoardUnit = { unit: RoomUnit; status: HousekeepingRoomStatus | null };

// A room switched off (isActive = false) takes no housekeeping action: nothing is cleaned or dirtied in a room
// that is out of service, and bulk changes must never reach it.
export function canChangeStatus(unit: Pick<RoomUnit, "isActive">): boolean {
  return unit.isActive;
}

function matchesStatus(item: BoardUnit, filter: StatusFilter): boolean {
  if (filter === "ALL") return true;
  const dirty = item.unit.housekeepingStatus === "DIRTY";
  if (filter === "NEEDS_CLEANING") return dirty;
  // The occupancy half is unknown when the property map failed: only clean/dirty can be matched then.
  if (item.status === null) return (filter === "VD" || filter === "OD") === dirty;
  return item.status.code === filter;
}

export function filterBoardUnits(items: BoardUnit[], status: StatusFilter, roomId: string | "ALL"): BoardUnit[] {
  return items.filter((i) => (roomId === "ALL" || i.unit.roomId === roomId) && matchesStatus(i, status));
}

// An arrival today is the room to have ready first; among those, the dirty ones first.
export function splitArrivals(items: BoardUnit[]): { arriving: BoardUnit[]; rest: BoardUnit[] } {
  const arriving = items.filter((i) => i.unit.isActive && i.status?.arrivingToday === true);
  const rest = items.filter((i) => !arriving.includes(i));
  arriving.sort(
    (a, b) =>
      Number(b.unit.housekeepingStatus === "DIRTY") - Number(a.unit.housekeepingStatus === "DIRTY") || a.unit.label.localeCompare(b.unit.label),
  );
  return { arriving, rest };
}

// Bulk changes touch only active rooms that are not already in the wanted state.
export function bulkTargets(items: BoardUnit[], selected: ReadonlySet<string>, to: "CLEAN" | "DIRTY"): RoomUnit[] {
  return items.filter((i) => selected.has(i.unit.id) && canChangeStatus(i.unit) && i.unit.housekeepingStatus !== to).map((i) => i.unit);
}
