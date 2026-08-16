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
  quantity: number;
  basePrice: string;
  images: string[];
  createdAt: string;
};

export type Booking = {
  id: string;
  roomId: string;
  room: Room;
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

// quantity/blockedCount/bookedCount are the raw counts for that day;
// availableCount = quantity - blockedCount - bookedCount and isn't clamped
// at 0, since a negative remainder is exactly what staff need to see.
export type AvailabilityDay = {
  date: string;
  quantity: number;
  blockedCount: number;
  bookedCount: number;
  availableCount: number;
};
export type AvailabilityResponse = { days: AvailabilityDay[] };

export type PublicAvailabilityDay = { date: string; isBlocked: boolean };
export type PublicAvailabilityResponse = { days: PublicAvailabilityDay[] };
