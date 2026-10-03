import type { MenuItem, Zone } from "@/lib/posTypes";

// Which menu items an order may be rung up with, decided by the zone of the table it's on - the
// one rule both POS ticket screens (AddOrderItemForm on /admin, PosMenuPicker on /pos) apply.
// A restaurant/bar/pool table only ever sees Kitchen/Bar items: a spa treatment listed next to
// the drinks was one wrong tap (or one untouched default) away from landing on a dinner bill. A
// SPA table sees only treatments. An order with no table at all (a named walk-up ticket, the spa
// billing door - which opens a table-less order linked to the appointment) keeps the whole menu,
// still grouped with Spa apart, because there is no table to say which side it belongs to.
export function menuForOrder(menu: MenuItem[], tableZone: Zone | null): MenuItem[] {
  const available = menu.filter((m) => m.isAvailable);
  if (tableZone === "SPA") return available.filter((m) => m.department === "SPA");
  if (tableZone !== null) return available.filter((m) => m.department !== "SPA");
  return available;
}
