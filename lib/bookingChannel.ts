import type { BookingChannel } from "@/lib/types";

// Display order for every channel picker — the ones front desk types in most often first.
export const BOOKING_CHANNELS: BookingChannel[] = ["WALK_IN", "PHONE", "DIRECT", "BOOKING_COM", "AIRBNB", "AGODA", "EXPEDIA", "OTHER"];

export const BOOKING_CHANNEL_LABELS: Record<BookingChannel, string> = {
  DIRECT: "Direct (website)",
  PHONE: "Phone",
  WALK_IN: "Walk-in",
  BOOKING_COM: "Booking.com",
  AIRBNB: "Airbnb",
  AGODA: "Agoda",
  EXPEDIA: "Expedia",
  OTHER: "Other",
};
