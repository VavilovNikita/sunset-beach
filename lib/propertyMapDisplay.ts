// The property map's state-priority rule, as a pure function so it's testable without rendering
// anything - see propertyMapDisplay.test.ts for every combination from the spec.
//
// Two independent visual channels, deliberately not one:
//
// 1. Base fill (dominant, always-visible signal - what must read instantly, without labels).
//    Checked top to bottom, first match wins:
//      - inactive  : RoomUnit.isActive=false - permanently out of service, gone from the picture.
//      - occupied  : a guest is checked in right now - wins over a same-day block (rare overlap:
//                    a block was scheduled before this guest checked out) because a real person
//                    in the room matters more moment-to-moment than a maintenance schedule; the
//                    block still surfaces as a badge so staff aren't blindsided at checkout.
//      - blocked   : a RoomUnitBlock covers today (temporary - reuses AvailabilityManager's own
//                    "coral = blocked" legend).
//      - vacant    : the one state that must pop - "ready to sell right now" (reuses the existing
//                    "sea = available" convention from the booking calendar).
//
// 2. Badges (stack on top of the fill, independent facts). Priority when only one fits on a
//    small tile: debt > dirty > today's arrival/departure timing > "also blocked" flag on an
//    occupied room. Money first (same caution as the folio-payment fix), then the operational
//    blocker (can't turn the room over), then pure timing information, then the rare overlap
//    case last. The tile only ever shows the top of this list; a click always shows everything.
import type { PropertyMapUnit } from "@/lib/types";

export type UnitFill = "inactive" | "occupied" | "blocked" | "vacant";

export type UnitBadge = "debt" | "dirty" | "departing-today" | "arriving-today" | "blocked-while-occupied";

export type UnitDisplay = {
  fill: UnitFill;
  // Priority order, most important first - badges[0] is what a space-constrained tile shows.
  badges: UnitBadge[];
};

export function resolveUnitDisplay(unit: PropertyMapUnit, today: string): UnitDisplay {
  const isOccupied = unit.currentBooking !== null && unit.currentBooking.occupancyStatus === "CHECKED_IN";
  const isArrivingToday = unit.currentBooking !== null && unit.currentBooking.occupancyStatus === "EXPECTED";

  if (!unit.isActive) {
    // Permanently out of service - gone from the picture entirely. A block/debt/dirty flag on a
    // room that isn't part of current operations would read as "still relevant" when it isn't;
    // none of that surfaces here (it's still visible in RoomUnitManager/AvailabilityManager,
    // just not on this glanceable screen).
    return { fill: "inactive", badges: [] };
  }

  const fill: UnitFill = isOccupied ? "occupied" : unit.activeBlock !== null ? "blocked" : "vacant";

  const badges: UnitBadge[] = [];
  if (isOccupied && unit.currentBooking !== null && Number(unit.currentBooking.outstandingBalance) > 0) {
    badges.push("debt");
  }
  if (unit.housekeepingStatus === "DIRTY") {
    badges.push("dirty");
  }
  if (isOccupied && unit.currentBooking !== null && unit.currentBooking.checkOut === today) {
    badges.push("departing-today");
  }
  if (isArrivingToday) {
    badges.push("arriving-today");
  }
  if (isOccupied && unit.activeBlock !== null) {
    badges.push("blocked-while-occupied");
  }

  return { fill, badges };
}
