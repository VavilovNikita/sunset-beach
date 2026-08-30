// Mirrors the JSON shapes returned by the Java API (see openapi.yaml in the
// `sunset` repo). Decimal fields (basePrice/totalPrice) serialize as strings,
// same quirk the old Prisma-backed API had — preserved here on purpose.

// Imported and re-exported rather than redeclared: this used to be its own
// `"ADMIN" | "MANAGER"` union here, a second, stale copy of lib/session.ts's
// real (hierarchical, 4-value) Role. That drift is exactly why UserRoleSelect
// could type-check while a WAITER/CASHIER `User.role` silently rendered as
// MANAGER in the picker — the type lied about what values could show up.
export type { Role } from "@/lib/session";
import type { Role } from "@/lib/session";
// Same deal: this used to be its own `{id, email, role, createdAt}` object
// here, a second copy of lib/session.ts's SessionUser — which is the exact
// same backend `User` schema (GET /auth/me and GET /users both return it).
// SessionUser was missing `createdAt` until now; re-exporting one definition
// means that kind of drift can only happen once instead of twice.
export type { SessionUser as User } from "@/lib/session";
export type BookingStatus = "NEW" | "CONFIRMED" | "PAID" | "CANCELLED";

export type Room = {
  id: string;
  name: string;
  description: string;
  capacity: number;
  // Replaces the old editable `quantity` — this is a count the backend
  // computes from active RoomUnit rows, not a field the client can set.
  // Rooms are added/removed one at a time via /room-units, not by editing
  // a number on the type.
  activeUnitCount: number;
  basePrice: string;
  images: string[];
  createdAt: string;
};

// A single physical room (e.g. "203") belonging to a Room *type*. Manual
// date blocks live here now, not on the type — see RoomUnitBlock. `label`
// is unique hotel-wide, not just within its room type (per openapi.yaml).
export type RoomUnit = {
  id: string;
  roomId: string;
  label: string;
  isActive: boolean;
  createdAt: string;
};

// Body of POST /room-units (openapi.yaml). GET /room-units — including the
// read used to populate any picker built from it — requires MANAGER or
// above; there's no lower-privilege read. PATCH/DELETE for edit/remove
// aren't in the excerpted spec but are implied by "CRUD /room-units".
export type RoomUnitInput = {
  roomId: string;
  label: string;
  isActive?: boolean;
};

// A manual withdrawal-from-sale for one physical room over a date range.
// Replaces the old per-type `blockedCount` withdrawal. `reason` is
// required by the backend; migrated rows carry reasons that start with
// "Auto-migrated from legacy block count" and need staff review — see
// components/admin/AvailabilityManager.tsx's AUTO_MIGRATED_PREFIX. No PATCH
// exists for this resource (per openapi.yaml) — changing a block's range or
// reason means DELETE the old one and POST a new one.
export type RoomUnitBlock = {
  id: string;
  roomUnitId: string;
  fromDate: string; // YYYY-MM-DD
  toDate: string; // YYYY-MM-DD
  reason: string;
  createdAt: string;
};

// Body of POST /room-units/{id}/blocks. fromDate <= toDate is enforced
// server-side (RoomUnitBlock_date_range_check).
export type RoomUnitBlockInput = {
  fromDate: string;
  toDate: string;
  reason: string;
};

export type Booking = {
  id: string;
  roomId: string;
  room: Room;
  // A booking can legitimately have no room assigned yet — that's a normal
  // pending state for front desk to fill in, not an error condition.
  roomUnitId: string | null;
  roomUnit: RoomUnit | null;
  guestName: string;
  guestEmail: string;
  guestPhone: string;
  checkIn: string;
  checkOut: string;
  totalPrice: string;
  status: BookingStatus;
  paymentNote: string | null;
  createdAt: string;
  updatedAt: string;
};

export type PricingDay = { date: string; price: number; isOverride: boolean };
export type PricingResponse = { basePrice: number; days: PricingDay[] };

// Per-day breakdown by physical room, replacing the old per-type
// quantity/blockedCount/bookedCount aggregate. `units` covers every active
// RoomUnit of the requested room type. Matches openapi.yaml's
// RoomUnitAvailability — isAvailable is exactly `!isBlocked && !isBooked`,
// computed server-side, so the client trusts it rather than re-deriving it.
export type AvailabilityUnitDay = {
  roomUnitId: string;
  label: string;
  isBlocked: boolean;
  isBooked: boolean;
  isAvailable: boolean;
  bookingId: string | null;
  blockReason: string | null;
};
export type AvailabilityDay = {
  date: string;
  units: AvailabilityUnitDay[];
};
export type AvailabilityResponse = { days: AvailabilityDay[] };

export type PublicAvailabilityDay = { date: string; isBlocked: boolean };
export type PublicAvailabilityResponse = { days: PublicAvailabilityDay[] };

// --- Booking calendar grid (GET /bookings/calendar) ---
//
// A deliberately different read model from AvailabilityResponse above, not a
// third way to compute the same thing: AvailabilityResponse answers "is this
// day/unit sellable" (booleans/counts) for one room type per month;
// BookingCalendarResponse answers "which booking, whose guest, what status"
// across every room type at once, for an arbitrary date range, to power a
// drag/resize Gantt-style grid. See openapi.yaml's GET /bookings/calendar
// description for the full reasoning.

// availableCount mirrors AvailabilityDay's — computed by the same shared
// server-side formula (InventoryMath), deliberately NOT clamped at zero. A
// negative value means more bookings/blocks than currently-active units
// (e.g. after a unit was deactivated) — render it as a distinct warning
// state, never floor it to 0 or show it as an ordinary number.
export type RoomTypeDailyAvailability = { date: string; availableCount: number };

export type RoomTypeCalendar = {
  roomId: string;
  roomName: string;
  roomUnits: RoomUnit[];
  dailyAvailable: RoomTypeDailyAvailability[];
};

// A lighter Booking projection for the grid — no nested room/roomUnit,
// cross-referenced against BookingCalendarResponse.roomTypes instead.
//
// checkIn/checkOut here are plain "YYYY-MM-DD" dates, UNLIKE Booking.checkIn/
// checkOut above (which carry a legacy "T00:00:00.000Z" time component, a
// Prisma serialization artifact this schema is new enough to not repeat).
// Route both through dateOnlyUTC() (lib/bookings.ts) regardless — never a
// manual string slice/parse; see that function's own comment about the past
// bug (a bad date parse silently zeroed dashboard revenue/occupancy).
export type CalendarBooking = {
  id: string;
  roomId: string;
  roomUnitId: string | null;
  guestName: string;
  checkIn: string;
  checkOut: string;
  status: BookingStatus;
  totalPrice: string;
};

export type BookingCalendarResponse = {
  from: string;
  to: string;
  roomTypes: RoomTypeCalendar[];
  bookings: CalendarBooking[];
  // Raw RoomUnitBlock rows, overlapping the range — NOT merged/deduplicated
  // server-side (a unit can have overlapping blocks, same as
  // GET /room-units/{id}/blocks). Merging for display is lib/calendarLayout.ts's job.
  blocks: RoomUnitBlock[];
};

// Body of PATCH /bookings/{id}/schedule and POST /bookings/{id}/schedule/quote
// — the booking's full desired schedule (dates + physical room together).
// roomUnitId is always sent (string or explicit null) — see openapi.yaml's
// schema description for why it's not typed optional despite the backend
// technically tolerating omission-as-error only (never rely on omission here).
export type BookingScheduleInput = {
  checkIn: string;
  checkOut: string;
  roomUnitId: string | null;
};

// Response of POST /bookings/{id}/schedule/quote — a non-mutating preview.
// totalPrice is always computed; available/reason report whether applying
// this exact change would currently succeed. Advisory only, not a lock — the
// apply call (PATCH .../schedule) re-validates from scratch.
export type BookingScheduleQuote = {
  totalPrice: string;
  nights: number;
  available: boolean;
  reason: string | null;
};

// Body of POST /bookings/staff — front-desk (walk-in) booking creation.
// Unlike BookingCreateInput (the public guest flow), guest contact details
// are optional and roomUnitId may be assigned immediately, atomically.
export type StaffBookingCreateInput = {
  roomId: string;
  guestName: string;
  guestEmail?: string | null;
  guestPhone?: string | null;
  checkIn: string;
  checkOut: string;
  roomUnitId?: string | null;
};

// --- Audit log (GET /audit-log) ---
//
// Read-only, append-only, MANAGER+ - see openapi.yaml's AuditLog tag description for the full
// list of what's recorded and why. `summary` is a plain-language sentence written by the backend
// service action that triggered the entry (see AuditLogService's javadoc for why that, and not a
// generic before/after field diff) — render it as-is, it's meant to be read directly.

export type AuditAction =
  | "BOOKING_CREATED"
  | "BOOKING_STATUS_CHANGED"
  | "BOOKING_PAYMENT_NOTE_CHANGED"
  | "BOOKING_SCHEDULE_CHANGED"
  | "BOOKING_ROOM_ASSIGNED"
  | "BOOKINGS_EXPORTED"
  | "ROOM_PRICE_CHANGED"
  | "RATE_OVERRIDE_CHANGED"
  | "ORDER_CLOSED"
  | "ORDER_CANCELLED"
  | "ROOM_CHARGE_POSTED"
  | "SHIFT_OPENED"
  | "SHIFT_CLOSED"
  | "SHIFT_EXPORTED"
  | "USER_CREATED"
  | "USER_ROLE_CHANGED"
  | "USER_ACTIVE_CHANGED"
  | "USER_PASSWORD_RESET"
  | "ROOM_UNIT_CREATED"
  | "ROOM_UNIT_UPDATED"
  | "ROOM_UNIT_DELETED"
  | "ROOM_UNIT_BLOCK_CREATED"
  | "ROOM_UNIT_BLOCK_DELETED";

// SCREAMING_SNAKE_CASE, not PascalCase entity names - see openapi.yaml's AuditEntityType schema
// description: Spring's default query-param enum binding uses the Java constant name, so this
// has to match that, not read nicely as a class name.
export type AuditEntityType = "BOOKING" | "ROOM" | "ORDER" | "SHIFT" | "USER" | "ROOM_UNIT";

export type AuditLogEntry = {
  id: string;
  actorUserId: string;
  // Snapshot at the time of the action, not a live join to the current User row - see
  // openapi.yaml's AuditLogEntry.actorEmail description. Still the right field to display: it's
  // who did it, even if that account was since renamed or (were deletion ever added) removed.
  actorEmail: string;
  actorRole: Role;
  action: AuditAction;
  entityType: AuditEntityType;
  entityId: string | null;
  summary: string;
  createdAt: string;
};

export type AuditLogPage = {
  items: AuditLogEntry[];
  page: number;
  pageSize: number;
  totalCount: number;
};
