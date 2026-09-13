// The spa table map's fill rule, as a pure function so it's testable without rendering anything -
// mirrors lib/propertyMapDisplay.ts's own resolveUnitDisplay in spirit, deliberately simpler:
// spa tables carry no block/debt/dirty facts, so there's nothing to badge, only one fill axis to
// resolve. Checked in this order, first match wins:
//   - inactive : Table.isActive=false - permanently out of service, dimmed, same as
//                PropertyMapUnit's own "gone from the picture" treatment for a deactivated room.
//   - busy     : occupied right now by a BOOKED/COMPLETED appointment - reuses the existing
//                "occupied without a problem" neutral fill (ink2) from the property map, not a
//                new colour - the palette is full (see CLAUDE.md's Colour meanings section).
//   - free     : reuses the existing "sea = available" convention.
import type { SpaMapTable } from "@/lib/posTypes";

export type SpaTableFill = "inactive" | "busy" | "free";

export function resolveSpaTableFill(table: SpaMapTable): SpaTableFill {
  if (!table.isActive) return "inactive";
  if (table.busy) return "busy";
  return "free";
}
