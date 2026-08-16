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
  PREBILL: "Pre-bill",
  GUEST_RECEIPT: "Guest receipt",
  Z_REPORT: "Z-report",
  TEST_PAGE: "Test page",
};
