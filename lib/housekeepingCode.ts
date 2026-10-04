import type { PropertyMapUnit } from "@/lib/types";

// The front-office room status codes housekeeping works from: occupancy (Vacant / Occupied)
// crossed with cleaning state (Clean / Dirty). Occupancy is the backend's call - a guest is in the
// room when the property map says CHECKED_IN (OverstayRule included); nothing here re-derives it
// from dates. "Arriving today" / "due out today" are hints on top, not separate codes: a VC room
// with an arrival is the one to check first.

export type HousekeepingCode = "VC" | "VD" | "OC" | "OD";

export const HOUSEKEEPING_CODE_LABELS: Record<HousekeepingCode, string> = {
  VC: "Vacant clean",
  VD: "Vacant dirty",
  OC: "Occupied clean",
  OD: "Occupied dirty",
};

export type HousekeepingRoomStatus = {
  code: HousekeepingCode;
  occupied: boolean;
  arrivingToday: boolean;
  departingToday: boolean;
  outOfOrder: boolean;
};

// `occupancy` is the room's property-map row; undefined when that read failed or the room is
// missing from it - then the occupancy half is unknown and only clean/dirty is shown.
export function resolveHousekeepingStatus(
  housekeepingStatus: "CLEAN" | "DIRTY",
  occupancy: PropertyMapUnit | undefined,
  today: string,
): HousekeepingRoomStatus | null {
  if (occupancy === undefined) return null;
  const booking = occupancy.currentBooking;
  const occupied = booking !== null && booking.occupancyStatus === "CHECKED_IN";
  const dirty = housekeepingStatus === "DIRTY";
  const code: HousekeepingCode = occupied ? (dirty ? "OD" : "OC") : dirty ? "VD" : "VC";
  return {
    code,
    occupied,
    arrivingToday: booking !== null && booking.occupancyStatus === "EXPECTED",
    departingToday: occupied && booking !== null && booking.checkOut <= today,
    outOfOrder: occupancy.activeBlock !== null,
  };
}
