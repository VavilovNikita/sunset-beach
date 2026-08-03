// Mirrors the JSON shapes returned by the Java API (see openapi.yaml in the
// `sunset` repo). Decimal fields (basePrice/totalPrice) serialize as strings,
// same quirk the old Prisma-backed API had — preserved here on purpose.

export type Role = "ADMIN" | "MANAGER";
export type BookingStatus = "NEW" | "CONFIRMED" | "PAID" | "CANCELLED";

export type Room = {
  id: string;
  name: string;
  description: string;
  capacity: number;
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

export type User = {
  id: string;
  email: string;
  role: Role;
  createdAt: string;
};

export type PricingDay = { date: string; price: number; isOverride: boolean };
export type PricingResponse = { basePrice: number; days: PricingDay[] };

export type AvailabilityDay = { date: string; isBlocked: boolean; source: "booking" | "manual" | null };
export type AvailabilityResponse = { days: AvailabilityDay[] };

export type PublicAvailabilityDay = { date: string; isBlocked: boolean };
export type PublicAvailabilityResponse = { days: PublicAvailabilityDay[] };
