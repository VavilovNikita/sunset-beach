import { housekeepingCode, type HousekeepingCode } from "@/lib/housekeepingCode";
import type { HousekeepingRoom } from "@/lib/types";

// What the Room status board shows for the chosen filters, and in which order. Pure, so the order
// ("arriving today first") and the rule for a room that is out of service are tested rather than eyeballed.

export type StatusFilter = "ALL" | HousekeepingCode | "NEEDS_CLEANING";

// A room switched off (isActive = false) takes no housekeeping action: nothing is cleaned or dirtied in a room
// that is out of service, and bulk changes must never reach it.
export function canChangeStatus(room: Pick<HousekeepingRoom, "isActive">): boolean {
  return room.isActive;
}

function matchesStatus(room: HousekeepingRoom, filter: StatusFilter): boolean {
  if (filter === "ALL") return true;
  if (filter === "NEEDS_CLEANING") return room.housekeepingStatus === "DIRTY";
  return housekeepingCode(room) === filter;
}

export function filterBoardRooms(rooms: HousekeepingRoom[], status: StatusFilter, roomId: string | "ALL"): HousekeepingRoom[] {
  return rooms.filter((r) => (roomId === "ALL" || r.roomId === roomId) && matchesStatus(r, status));
}

// An arrival today is the room to have ready first; among those, the dirty ones first.
export function splitArrivals(rooms: HousekeepingRoom[]): { arriving: HousekeepingRoom[]; rest: HousekeepingRoom[] } {
  const arriving = rooms.filter((r) => r.isActive && r.arrivingToday);
  const rest = rooms.filter((r) => !arriving.includes(r));
  arriving.sort(
    (a, b) => Number(b.housekeepingStatus === "DIRTY") - Number(a.housekeepingStatus === "DIRTY") || a.unitLabel.localeCompare(b.unitLabel)
  );
  return { arriving, rest };
}

// The room types present, for the filter, by name.
export function roomTypesOf(rooms: HousekeepingRoom[]): { id: string; name: string }[] {
  const names = new Map(rooms.map((r) => [r.roomId, r.roomName]));
  return Array.from(names, ([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
}

// Bulk changes touch only active rooms that are not already in the wanted state.
export function bulkTargets(rooms: HousekeepingRoom[], selected: ReadonlySet<string>, to: "CLEAN" | "DIRTY"): HousekeepingRoom[] {
  return rooms.filter((r) => selected.has(r.roomUnitId) && canChangeStatus(r) && r.housekeepingStatus !== to);
}
