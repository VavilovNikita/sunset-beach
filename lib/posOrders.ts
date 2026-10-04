// Pure formatting/lookup helpers shared by POS admin components — no fetch,
// mirrors the role lib/bookings.ts plays for date math.
import type {
  OrderStatus,
  PaymentMethod,
  Zone,
  MenuDepartment,
  PrinterDepartment,
  PrintJobStatus,
  PrintDocumentType,
} from "@/lib/posTypes";

// Same color mapping as BookingsTable's STATUS_STYLES (lib/types.ts's
// BookingStatus): OPEN~NEW, SENT~CONFIRMED, PAID/CANCELLED match by name.
export const STATUS_STYLES: Record<OrderStatus, string> = {
  OPEN: "bg-sea/15 text-sea",
  SENT: "bg-coral/15 text-coral",
  PAID: "bg-green-500/15 text-green-400",
  CANCELLED: "bg-cream/10 text-cream/40",
};

export const STATUS_LABELS: Record<OrderStatus, string> = {
  OPEN: "Open",
  SENT: "Sent",
  PAID: "Paid",
  CANCELLED: "Cancelled",
};

export const ZONE_LABELS: Record<Zone, string> = {
  RESTAURANT: "Restaurant",
  BAR: "Bar",
  SPA: "Spa",
  POOL: "Pool",
  ROOM_SERVICE: "Room service",
};

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  CASH: "Cash",
  CARD: "Card",
  ROOM_CHARGE: "Room charge",
  OTHER: "Other",
};

export function isTerminalStatus(status: OrderStatus) {
  return status === "PAID" || status === "CANCELLED";
}

// MenuDepartment (KITCHEN/BAR only, no CASHIER) drives which ticket printer
// a line item routes to — separate from PrinterDepartment below, which also
// covers CASHIER (pre-bills/receipts/Z-reports, never routed by menu item).
export const MENU_DEPARTMENT_LABELS: Record<MenuDepartment, string> = {
  KITCHEN: "Kitchen",
  BAR: "Bar",
  SPA: "Spa (no ticket)",
};

export const PRINTER_DEPARTMENT_LABELS: Record<PrinterDepartment, string> = {
  KITCHEN: "Kitchen",
  BAR: "Bar",
  CASHIER: "Cashier",
};

export const PRINT_JOB_STATUS_STYLES: Record<PrintJobStatus, string> = {
  PENDING: "bg-sea/15 text-sea",
  SENT: "bg-green-500/15 text-green-400",
  FAILED: "bg-coral/15 text-coral",
};

export const PRINT_JOB_STATUS_LABELS: Record<PrintJobStatus, string> = {
  PENDING: "Pending",
  SENT: "Sent",
  FAILED: "Failed",
};

export const PRINT_DOCUMENT_TYPE_LABELS: Record<PrintDocumentType, string> = {
  KITCHEN_TICKET: "Kitchen ticket",
  BAR_TICKET: "Bar ticket",
  PREBILL: "Pre-bill",
  GUEST_RECEIPT: "Guest receipt",
  Z_REPORT: "Z-report",
  TEST_PAGE: "Test page",
};

// Order.number is the receipt number staff and guests see ("#1234", also printed on every
// ticket); the id stays the key, shown as a short reference next to it - the same first-8-chars
// form the backend prints on a receipt ("ref 4F6C31F1").
export function orderNumberLabel(order: { number: number }): string {
  return `#${order.number}`;
}

export function orderRefLabel(order: { id: string }): string {
  return order.id.slice(0, 8).toUpperCase();
}

// What a ticket without a table is called in lists and headers.
export function ticketTitle(order: { number: number; guestName: string | null }): string {
  return order.guestName ?? `Ticket ${orderNumberLabel(order)}`;
}

// An OPEN/SENT order this old is almost always a forgotten table or a ticket nobody closed, not a
// long dinner - flagged on the floor boards so someone looks at it.
export const LONG_OPEN_HOURS = 24;

export function isLongOpen(order: { status: OrderStatus; createdAt: string }, now: Date): boolean {
  if (order.status !== "OPEN" && order.status !== "SENT") return false;
  const openedAt = new Date(order.createdAt).getTime();
  if (Number.isNaN(openedAt)) return false;
  return now.getTime() - openedAt >= LONG_OPEN_HOURS * 3600_000;
}

// "Open 3 days" / "Open 26 h" - only meaningful once isLongOpen.
export function longOpenLabel(createdAt: string, now: Date): string {
  const hours = Math.floor((now.getTime() - new Date(createdAt).getTime()) / 3600_000);
  if (hours >= 48) return `Open ${Math.floor(hours / 24)} days`;
  return `Open ${hours} h`;
}

// A spa ticket in a list of open tickets: billed for a spa appointment (the server's link), or on
// a spa table.
export function isSpaOrder(order: { spaAppointmentId: string | null }, tableZone: Zone | null | undefined): boolean {
  return order.spaAppointmentId !== null || tableZone === "SPA";
}

export const VOID_REASON_MAX = 500;

// Voiding a sent line needs a reason (the server refuses a blank one too). An English message, or
// null when it's fine.
export function validateVoidReason(reason: string): string | null {
  const trimmed = reason.trim();
  if (trimmed.length < 3) return "Say why this item is being voided.";
  if (trimmed.length > VOID_REASON_MAX) return `Keep the reason under ${VOID_REASON_MAX} characters.`;
  return null;
}

// What's on a table's tile: the running bill of its open orders, each order's own server-computed
// total (never re-derived from lines here). Null for an empty table or a bill that's still ฿0.
export function tableBillLabel(orders: { total: string }[]): string | null {
  const sum = orders.reduce((acc, o) => acc + Number(o.total), 0);
  return sum > 0 ? `฿${sum.toLocaleString("en-US")}` : null;
}
