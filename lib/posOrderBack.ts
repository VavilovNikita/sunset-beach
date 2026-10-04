import { hotelDateKey } from "@/lib/hotelDate";
import type { Zone } from "@/lib/posTypes";

// Which section an order ticket belongs to, and where its "back" goes. A spa ticket (it bills a
// spa appointment, or sits on a SPA-zone table) belongs to the spa section on the desktop - its
// schedule for the day the ticket was opened, which is the day reception billed the appointment.
// The phone has no spa screens, so every ticket there goes back to the phone's own table board.
export function isSpaOrder(order: { spaAppointmentId: string | null }, tableZone: Zone | null): boolean {
  return order.spaAppointmentId !== null || tableZone === "SPA";
}

export function orderBackLink(
  basePath: "/admin/pos" | "/pos",
  order: { spaAppointmentId: string | null; createdAt: string },
  tableZone: Zone | null,
): { href: string; label: string } {
  if (basePath === "/admin/pos" && isSpaOrder(order, tableZone)) {
    return { href: `/admin/spa?date=${hotelDateKey(new Date(order.createdAt))}`, label: "← Spa schedule" };
  }
  return { href: basePath, label: "← Back to tables" };
}
