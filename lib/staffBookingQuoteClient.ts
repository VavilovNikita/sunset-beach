// POST /bookings/staff/quote - the new-booking form's price preview. The server prices the nights
// exactly as POST /bookings/staff would; this never sums anything itself (see CLAUDE.md, "Money").
// Advisory: the create call re-prices and re-checks availability from scratch.
import { adminRequest, adminJsonInit, type AdminResult } from "@/lib/adminFetch";
import type { BookingScheduleQuote, StaffBookingQuoteInput } from "@/lib/types";

export function quoteStaffBooking(input: StaffBookingQuoteInput): Promise<AdminResult<BookingScheduleQuote>> {
  return adminRequest<BookingScheduleQuote>("/bookings/staff/quote", adminJsonInit("POST", input), "Could not price this stay.");
}
