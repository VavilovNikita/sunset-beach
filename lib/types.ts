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
  housekeepingStatus: HousekeepingStatus;
  createdAt: string;
};

// Cleaning state of a physical room — independent of RoomUnitBlock (which pulls a unit off sale
// for a written reason: maintenance, renovation). A DIRTY room is still sellable/assignable;
// checking a guest into one warns front desk rather than blocking them. Set via
// PATCH /room-units/{id}/housekeeping, CASHIER+ (a lower bar than the rest of /room-units,
// which stays MANAGER+) — see HousekeepingStatusInput.
export type HousekeepingStatus = "DIRTY" | "CLEAN";

export type HousekeepingStatusInput = {
  housekeepingStatus: HousekeepingStatus;
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

// One "room X from date A to date B" leg of a booking's stay — see
// BookingWriter's javadoc (backend) for the full model. checkIn/checkOut here
// are plain "YYYY-MM-DD" dates, the same format Booking.checkIn/checkOut and
// CalendarBooking's below use too. Still route through dateOnlyUTC()
// (lib/bookings.ts) rather than a manual string slice/parse either way.
export type BookingSegment = {
  id: string;
  roomId: string;
  room: Room;
  roomUnitId: string | null;
  roomUnit: RoomUnit | null;
  checkIn: string;
  checkOut: string;
  totalPrice: string;
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
  // Whether the guest is physically at the hotel — deliberately separate from `status` (which
  // stays commercial only: confirmed/paid/cancelled). One value per booking, not per segment: a
  // relocation mid-stay never touches this. Never affects availability — see OccupancyStatus.
  occupancyStatus: OccupancyStatus;
  checkedInAt: string | null;
  checkedOutAt: string | null;
  // roomId/room/roomUnitId/roomUnit/checkIn/checkOut/totalPrice above are all
  // derived from segments (the *last* segment's room; the first segment's
  // checkIn and the last segment's checkOut; the sum of every segment's
  // totalPrice) — a booking that's never been relocated has exactly one
  // segment and these values equal that segment's own fields exactly.
  // Ordered by checkIn ascending, never empty.
  segments: BookingSegment[];
  createdAt: string;
  updatedAt: string;
};

// NO_SHOW is a label, not an action: POST /bookings/{id}/no-show changes nothing about the
// booking's dates, status, or availability — releasing the nights is the existing
// cancel/shorten path, a separate deliberate step. Never read by the availability engine.
export type OccupancyStatus = "EXPECTED" | "CHECKED_IN" | "CHECKED_OUT" | "NO_SHOW";

// Response of POST /bookings/{id}/check-in. `warning` is set (check-in still succeeds) when the
// room being checked into is DIRTY — front desk is told, not blocked.
export type CheckInResult = {
  booking: Booking;
  warning: string | null;
};

// Response of POST /bookings/{id}/check-out. `outstandingBalance` is what's actually left to
// collect right now (room total, if not yet PAID, plus any uncollected room-charge payments) —
// "0.00" means nothing is owed, not that the field was skipped.
export type CheckOutResult = {
  booking: Booking;
  outstandingBalance: string;
};

// One row of GET /bookings/today. Whether a room still needs assigning (booking.roomUnitId) or
// cleaning (booking.roomUnit.housekeepingStatus) is already on the embedded Booking.
export type TodayBoardEntry = {
  booking: Booking;
  outstandingBalance: string;
};

// Response of GET /bookings/today — the front desk's daily working set. A booking appears in
// exactly one list: arrivingToday (checkIn = today, occupancyStatus = EXPECTED), departingToday
// (checkOut = today, occupancyStatus = CHECKED_IN), or inHouse (occupancyStatus = CHECKED_IN,
// any date — departingToday is a same-day subset, not a separate population). A booking marked
// NO_SHOW or already CHECKED_OUT appears in none of the three.
export type TodayBoard = {
  arrivingToday: TodayBoardEntry[];
  departingToday: TodayBoardEntry[];
  inHouse: TodayBoardEntry[];
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

// One booking *segment* as rendered on the grid — a lighter BookingSegment
// projection (no nested room/roomUnit, cross-referenced against
// BookingCalendarResponse.roomTypes instead). `segmentId` is the SEGMENT's
// id, not the booking's — a relocated booking produces more than one
// CalendarBooking entry sharing the same `bookingId`, rendered as separate
// bars that all open the same booking's card on click. Anything that acts on
// the booking (open the card panel, quote/apply a schedule change, relocate)
// must use `bookingId`, never `segmentId` — the field is named for exactly
// what it identifies because a same-named-but-different-meaning `id` here
// once made every drag-to-edit handler send the wrong id and get a silent
// 404. `segmentCount` is the *whole* booking's segment count (1 for the
// overwhelmingly common never-relocated case) — used to decide whether
// drag-resize/drag-move is offered on this bar at all, without a second
// round trip to fetch the full booking.
//
// checkIn/checkOut here are plain "YYYY-MM-DD" dates, the same format
// Booking.checkIn/checkOut use too. Still route both through dateOnlyUTC()
// (lib/bookings.ts) rather than a manual string slice/parse; see that
// function's own comment about the past bug (a bad date parse silently
// zeroed dashboard revenue/occupancy).
export type CalendarBooking = {
  segmentId: string;
  bookingId: string;
  roomId: string;
  roomUnitId: string | null;
  guestName: string;
  checkIn: string;
  checkOut: string;
  status: BookingStatus;
  totalPrice: string;
  segmentCount: number;
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
//
// On a booking with more than one segment (booking.segments), only a change
// that moves exactly one outer edge of the stay is accepted: checkIn alone
// (early/late arrival, applied to the first segment) or checkOut alone
// (extend/shorten the stay, applied to the last segment), each without
// crossing into the neighboring segment. checkIn AND checkOut moving
// together, or neither moving (a room-only change with no segment named to
// apply it to), has no single well-defined segment and is rejected with 409
// — use RelocationInput/relocate for that. A date that would cross into the
// neighboring segment is rejected with 400 instead.
export type BookingScheduleInput = {
  checkIn: string;
  checkOut: string;
  roomUnitId: string | null;
};

// Response of both POST /bookings/{id}/schedule/quote and
// POST /bookings/{id}/relocate/quote (reused as-is, not duplicated) — a
// non-mutating preview. totalPrice is always computed (for relocate, the
// whole booking's new total after the move); available/reason report
// whether applying this exact change would currently succeed. Advisory only,
// not a lock — the apply call re-validates from scratch.
export type BookingScheduleQuote = {
  totalPrice: string;
  nights: number;
  available: boolean;
  reason: string | null;
};

// Body of POST /bookings/{id}/relocate and POST /bookings/{id}/relocate/quote
// — a guest moving to a different room (possibly a different room *type*,
// hence roomId being changeable here unlike BookingScheduleInput)
// partway through their stay. effectiveDate must fall strictly after the
// start of the segment currently covering it — splitting a segment on its
// own first night is "assign this segment a different room"
// (BookingScheduleInput when there's only one segment), not a mid-stay move.
export type RelocationInput = {
  effectiveDate: string;
  roomId: string;
  roomUnitId: string | null;
};

// Body of POST /bookings/{id}/undo-relocation — reverses a relocation,
// merging the two segments meeting at splitDate back into one (keeping the
// *earlier* segment's room). splitDate must be an existing segment boundary.
export type RelocationUndoInput = {
  splitDate: string;
};

// Body of POST /bookings/{id}/reprice and POST /bookings/{id}/reprice/quote — the one explicit,
// manager-only way to move an already-agreed price forward to today's rates. segmentId is
// required (not inferred) since a relocated booking has more than one segment and there is no
// single unambiguous default.
export type RepriceInput = {
  segmentId: string;
};

// Response of POST /bookings/{id}/reprice/quote — a non-mutating preview. Only nights from today
// onward within the segment are ever repriced; nightsRepriced is 0 (oldTotalPrice ==
// newTotalPrice) when the segment has nothing left to reprice (entirely in the past).
export type RepriceQuote = {
  oldTotalPrice: string;
  newTotalPrice: string;
  nightsRepriced: number;
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
