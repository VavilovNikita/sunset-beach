// Mirrors the JSON shapes returned by the Java API's POS module (menu,
// tables, orders, shifts, payments) — checked against the finalized backend
// contract. Same Decimal convention as lib/types.ts, but note the direction
// matters here: response fields (MenuItem.price, Order.total, etc.) are
// strings; the matching *Input request bodies take plain numbers.
export type Zone = "RESTAURANT" | "BAR" | "SPA" | "POOL" | "ROOM_SERVICE";
export type OrderStatus = "OPEN" | "SENT" | "PAID" | "CANCELLED";
export type PaymentMethod = "CASH" | "CARD" | "ROOM_CHARGE" | "OTHER";

// Where a MenuItem's kitchen/bar ticket prints — independent of `category`,
// which is a free-text display grouping for the menu itself (e.g. "Mains",
// "Cocktails") and has no effect on print routing.
export type MenuDepartment = "KITCHEN" | "BAR";

export type MenuItem = {
  id: string;
  name: string;
  description: string;
  category: string;
  department: MenuDepartment;
  price: string;
  isAvailable: boolean;
  createdAt: string;
};

export type MenuItemInput = {
  name: string;
  description: string;
  category: string;
  department?: MenuDepartment;
  price: number;
  isAvailable?: boolean;
};

// What a Printer receives. KITCHEN/BAR get routed kitchen/bar tickets (split
// from order line items by MenuItem.department); CASHIER gets pre-bills,
// guest receipts, and shift Z-reports — nothing routed by menu department
// ever goes there. Not the same enum as MenuDepartment.
export type PrinterDepartment = "KITCHEN" | "BAR" | "CASHIER";

export type PrinterCodepage = "PC437" | "TIS620";

export type Printer = {
  id: string;
  name: string;
  department: PrinterDepartment;
  host: string;
  port: number;
  codepage: PrinterCodepage;
  isActive: boolean;
  createdAt: string;
};

export type PrinterInput = {
  name: string;
  department: PrinterDepartment;
  host: string;
  port?: number;
  codepage?: PrinterCodepage;
  isActive?: boolean;
};

export type PrintDocumentType = "KITCHEN_TICKET" | "BAR_TICKET" | "PREBILL" | "GUEST_RECEIPT" | "Z_REPORT" | "TEST_PAGE";
export type PrintJobStatus = "PENDING" | "SENT" | "FAILED";

export type PrintJob = {
  id: string;
  printerId: string;
  documentType: PrintDocumentType;
  summary: string;
  status: PrintJobStatus;
  attempts: number;
  lastError: string | null;
  createdAt: string;
  updatedAt: string;
  // Set once this FAILED job is closed as not-actionable (POST /print-jobs/dismiss) - dismiss
  // never changes `status`, it only stops the job counting toward the default list/badge/banner
  // (GET /print-jobs excludes dismissed jobs unless includeDismissed=true).
  dismissedAt: string | null;
  dismissedByUserId: string | null;
  dismissNote: string | null;
};

// Body of POST /print-jobs/dismiss - bulk (a single job is just an array of one). All-or-nothing:
// every id must exist, be visible to the caller's role, be currently FAILED, and not already
// dismissed, or the whole call is rejected.
export type DismissPrintJobsInput = {
  ids: string[];
  note?: string;
};

// Result of an on-demand print action (test print, pre-bill) that may
// legitimately have nothing to print to — `attempted: false` means there was
// no active printer configured for the target department, not an error.
export type PrintAttemptResult = {
  attempted: boolean;
  job: PrintJob | null;
};

export type Table = {
  id: string;
  zone: Zone;
  label: string;
  capacity: number;
  isActive: boolean;
};

export type TableInput = {
  zone: Zone;
  label: string;
  capacity: number;
  isActive?: boolean;
};

// No denormalized menu item name — items only carry menuItemId. Consumers
// resolve names from a MenuItem[] they already fetched (see OrderTicket's
// menuById map) rather than re-fetching per item.
export type OrderItem = {
  id: string;
  orderId: string;
  menuItemId: string;
  quantity: number;
  unitPrice: string;
  note: string | null;
  createdAt: string;
  // Set the moment this line went out on a printed kitchen/bar ticket (the original send, or a
  // later re-order print) — regardless of whether the print itself reached the printer. A
  // repeated POST /orders/{id}/items only merges into an existing line when this is still null;
  // once set, a matching add becomes its own new (unsent) line instead.
  sentAt: string | null;
};

export type OrderItemInput = {
  menuItemId: string;
  quantity: number;
  note?: string | null;
};

// Both GET /orders and GET /orders/{id} always include items[] — there's no
// lighter-weight list shape, so a single Order type covers both.
export type Order = {
  id: string;
  tableId: string | null;
  bookingId: string | null;
  guestName: string | null;
  status: OrderStatus;
  openedByUserId: string;
  // Denormalized the same way ShiftListItem.openedByEmail is — a MANAGER building a staff
  // filter can't fall back to GET /users (ADMIN-only).
  openedByEmail: string;
  total: string;
  note: string | null;
  items: OrderItem[];
  createdAt: string;
  updatedAt: string;
  // null until the order is PAID; set once and never changed after that. See the field's
  // openapi.yaml doc for why it's on Order at all (there's no way to fetch a Payment by orderId).
  paymentMethod: PaymentMethod | null;
};

export type OrderCreateInput = {
  tableId?: string;
  bookingId?: string;
  guestName?: string;
};

// No `amount` — the server always charges order.total itself; partial
// payment isn't supported. The response Order is the source of truth for
// how much was actually charged (see OrderTicket's lastPayment).
export type CloseOrderInput = {
  method: PaymentMethod;
  bookingId?: string;
};

export type Shift = {
  id: string;
  openedByUserId: string;
  openedAt: string;
  closedByUserId: string | null;
  closedAt: string | null;
  openingCashFloat: string | null;
  closingCashCounted: string | null;
  status: "OPEN" | "CLOSED";
  notes: string | null;
};

export type ShiftTotals = {
  cash: string;
  card: string;
  roomCharge: string;
  other: string;
  paymentCount: number;
};

export type ShiftSummary = Shift & { totals: ShiftTotals };

export type ShiftOpenInput = { openingCashFloat?: number };
export type ShiftCloseInput = { closingCashCounted?: number; notes?: string };

// One row of GET /shifts (MANAGER+) - reconciliation numbers already computed server-side (see
// ShiftService#list), not re-derived here the way PosShiftPanel/admin ShiftPanel have to for a
// single in-progress shift that hasn't been through that endpoint yet.
export type ShiftListItem = {
  id: string;
  openedByUserId: string;
  openedByEmail: string;
  openedAt: string;
  closedByUserId: string | null;
  closedByEmail: string | null;
  closedAt: string | null;
  openingCashFloat: string | null;
  closingCashCounted: string | null;
  status: "OPEN" | "CLOSED";
  totals: ShiftTotals;
  expectedCash: string;
  discrepancy: string | null;
};

// POST /orders/{id}/close creates this server-side, but the endpoint returns
// the updated Order, not the Payment itself — nothing in this codebase reads
// this type by fetching it; it exists for documentation of the shape that
// exists on the backend. See OrderTicket's lastPayment for how the UI shows
// "paid via X, ฿Y" without it (sourced from what the form just sent).
export type Payment = {
  id: string;
  orderId: string;
  method: PaymentMethod;
  amount: string;
  bookingId: string | null;
  recordedByUserId: string;
  shiftId: string;
  createdAt: string;
};

export type BookingPosOrder = {
  orderId: string;
  amount: string;
  paidAt: string;
  items: { name: string; quantity: number }[];
};

// GET /bookings/{id}/folio — room stay + POS room charges, combined into
// what the front desk collects at checkout.
// roomChargesTotal is *net of settlement* — see FolioPayment below for how a room charge gets
// marked collected. roomChargeCount is a raw historical count (how many ROOM_CHARGE payments
// this stay ever generated), not "how many are still unsettled" — individual charges aren't
// tracked as settled/unsettled, only the running total is.
export type Folio = {
  roomTotal: string;
  roomChargesTotal: string;
  folioTotal: string;
  roomChargeCount: number;
};

// Excludes ROOM_CHARGE — a room charge can't be settled by charging it to the room.
export type FolioPaymentMethod = "CASH" | "CARD" | "OTHER";

// Money actually collected against a booking's folio — the record that makes a ROOM_CHARGE
// payment's amount stop counting as owed in Folio.roomChargesTotal / the check-out warning /
// the today board. Deliberately not tied to a shift — unlike a POS Payment, cash collected this
// way isn't counted in end-of-shift cash-drawer reconciliation, the same gap Booking.status =
// PAID already has for the room portion of a stay. Rows accumulate (a guest can pay part now,
// the rest later) and are never edited or deleted.
export type FolioPayment = {
  id: string;
  bookingId: string;
  method: FolioPaymentMethod;
  amount: string;
  recordedByUserId: string;
  createdAt: string;
};

// Body of POST /bookings/{id}/folio-payments. Rejected with a 409 if amount would exceed what's
// currently outstanding on the folio's room-charges portion — a fat-finger guard, not a
// restriction on partial payment.
export type FolioPaymentInput = {
  method: FolioPaymentMethod;
  amount: string;
};

// GET /payments/summary?from&to — MANAGER+. grandTotal deliberately excludes
// totals.roomCharge: a room charge is money moved onto a booking's folio,
// not money collected yet, so folding it into "revenue" here would double
// count it against the room's own payment later. See lib/adminStats.ts for
// how the dashboard keeps this separate from room revenue instead of adding
// them together.
export type PaymentsSummary = {
  from: string;
  to: string;
  totals: {
    cash: string;
    card: string;
    roomCharge: string;
    other: string;
    paymentCount: number;
  };
  grandTotal: string;
};
