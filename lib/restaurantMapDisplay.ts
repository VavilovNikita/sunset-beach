// The restaurant map's display and tap rules, as pure functions - same shape as
// lib/spaMapDisplay.ts. Fill, first match wins:
//   - inactive : Table.isActive=false - dimmed, same as a deactivated spa table or room.
//   - busy     : has an OPEN/SENT order - the existing neutral "occupied" fill, not a new colour.
//   - free     : the existing "sea = available".
import type { RestaurantMapTable } from "@/lib/posTypes";

export type RestaurantTableFill = "inactive" | "busy" | "free";

export function resolveRestaurantTableFill(table: RestaurantMapTable): RestaurantTableFill {
  if (!table.isActive) return "inactive";
  if (table.openOrderIds.length > 0) return "busy";
  return "free";
}

// What opening a tile does - the same rules as OrderBoard's own handleTableClick, so the map and
// the list never disagree about a table: one open order opens it, several ask which, none starts
// a new one - except on a deactivated table, which never gets a new order (its existing orders
// still open normally, so a deactivated table never strands one).
export type RestaurantTableAction =
  | { kind: "open"; orderId: string }
  | { kind: "pick"; orderIds: string[] }
  | { kind: "start" }
  | { kind: "none" };

export function resolveRestaurantTableAction(table: RestaurantMapTable): RestaurantTableAction {
  if (table.openOrderIds.length > 1) return { kind: "pick", orderIds: table.openOrderIds };
  if (table.openOrderIds.length === 1) return { kind: "open", orderId: table.openOrderIds[0] };
  if (!table.isActive) return { kind: "none" };
  return { kind: "start" };
}

export function restaurantTableStateLabel(table: RestaurantMapTable): string {
  if (!table.isActive) return table.openOrderIds.length > 0 ? "Inactive — has an open order" : "Inactive";
  if (table.openOrderIds.length > 1) return `${table.openOrderIds.length} open orders`;
  if (table.openOrderIds.length === 1) return "Open order";
  return "Free";
}
