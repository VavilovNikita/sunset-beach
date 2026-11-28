// The warning on a guest a planned move put into a room an earlier guest has not left (Booking.roomStillHeld). The
// sentence and the state are the server's; this only says how it looks and where its link goes. Pure, tested in
// roomStillHeld.test.ts.
import type { RoomStillHeld } from "@/lib/types";

export function roomStillHeldDisplay(held: Pick<RoomStillHeld, "bookingId" | "state">): {
  overdue: boolean;
  href: string;
  linkText: string;
} {
  const booking = `/admin/bookings/${held.bookingId}`;
  // A guest only waiting to be moved is dealt with by picking their room; anybody else is checked out or extended.
  return held.state === "AWAITING_ROOM"
    ? { overdue: false, href: `${booking}#choose-room`, linkText: "Choose their room" }
    : { overdue: held.state === "PAST_CHECK_OUT", href: booking, linkText: "Open their booking" };
}
