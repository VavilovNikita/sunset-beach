import type { HousekeepingRoom } from "@/lib/types";

// The front-office room status codes housekeeping works from: occupancy (Vacant / Occupied) crossed with cleaning
// state (Clean / Dirty). Both halves are the server's (GET /housekeeping/rooms, OverstayRule included); nothing here
// re-derives who is in a room from dates. "Arriving today" / "due out today" are hints on top, not separate codes.

export type HousekeepingCode = "VC" | "VD" | "OC" | "OD";

export const HOUSEKEEPING_CODE_LABELS: Record<HousekeepingCode, string> = {
  VC: "Vacant clean",
  VD: "Vacant dirty",
  OC: "Occupied clean",
  OD: "Occupied dirty",
};

export function housekeepingCode(room: Pick<HousekeepingRoom, "occupied" | "housekeepingStatus">): HousekeepingCode {
  const dirty = room.housekeepingStatus === "DIRTY";
  return room.occupied ? (dirty ? "OD" : "OC") : dirty ? "VD" : "VC";
}
