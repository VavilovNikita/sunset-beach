import type { Booking, BookingChannel } from "@/lib/types";

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

// SiteMinder is not a BookingChannel and never belongs in the pickers above: `channel` is how the
// guest booked (Booking.com, Expedia...), and SiteMinder is only how the reservation reached *us*
// - the import maps SiteMinder's channel name onto `channel` and keeps the raw name in
// `externalChannel` (backend SiteMinderImportService#mapChannel). Staff never create a SiteMinder
// booking by hand: one typed in would sit beside the real import with no reference to match on.
// So "came via SiteMinder" is shown from `externalReference`, read-only. Pure, tested in
// bookingChannel.test.ts.
export function bookingOriginNote(booking: Pick<Booking, "externalReference" | "externalChannel">): string | null {
  if (!booking.externalReference) return null;
  const via = booking.externalChannel ? ` (${booking.externalChannel})` : "";
  return `via SiteMinder${via}, ref ${booking.externalReference}`;
}
