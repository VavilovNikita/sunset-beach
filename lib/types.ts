// Mirrors the JSON shapes returned by the Java API (see openapi.yaml in the
// `sunset` repo). Decimal fields (basePrice/totalPrice) serialize as strings,
// same quirk the old Prisma-backed API had — preserved here on purpose.

// Imported and re-exported rather than redeclared: this used to be its own
// `"ADMIN" | "MANAGER"` union here, a second, stale copy of lib/session.ts's
// real (hierarchical, 4-value) Role. That drift is exactly why UserRoleSelect
// could type-check while a WAITER/CASHIER `User.role` silently rendered as
// MANAGER in the picker — the type lied about what values could show up.
export type { Role } from "@/lib/session";
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
