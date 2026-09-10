// Opens (or would-be-opens) the one POS order that bills a spa appointment's treatment - the
// billing door reception reaches directly from the appointment on the spa schedule, now that
// spa tables are hidden from the admin POS floor view (see AdminPosPage's own comment). Sends
// spaAppointmentId explicitly on creation - OrderCreateInput.spaAppointmentId was built as the
// override no screen actually sent; this is the screen it was for, so the link this door makes
// is deterministic, not an inference. The auto-resolution axes (OrderService#
// autoLinkSpaAppointmentByTable/ByBooking) are untouched and still cover every order opened any
// other way (the floor view, a table-less room-charge ticket, and so on).
import { adminRequest, adminJsonInit } from "@/lib/adminFetch";
import type { Order, SpaAppointment } from "@/lib/posTypes";

// The two writes below (create, then add the line) can't be made atomic from the browser. If the
// first succeeds and the second doesn't, the appointment is already linked to a real order - the
// ⚠ this whole mechanism exists to raise goes quiet the moment that link is set, whether or not
// the order actually carries the treatment. So `itemAdded: false` is its own outcome, not folded
// into failure or silently dropped: the order was opened (and is linked - see orderId), the line
// just isn't on it yet. The caller must say so plainly, not just proceed as if nothing happened.
export type BillSpaAppointmentResult =
  | { ok: true; orderId: string; itemAdded: true }
  | { ok: true; orderId: string; itemAdded: false; itemError: string }
  | { ok: false; error: string };

export async function billSpaAppointment(appointment: SpaAppointment): Promise<BillSpaAppointmentResult> {
  // Pre-fills what the appointment already knows - its booking (so the guest doesn't have to be
  // looked up again) and its own id (the explicit link) - same "don't make reception retype what
  // the screen already knows" reasoning as the guest picker's seeded search.
  const createResult = await adminRequest<Order>(
    "/orders",
    adminJsonInit("POST", { bookingId: appointment.bookingId, spaAppointmentId: appointment.id, guestName: appointment.guestName }),
    "Could not open an order for this appointment."
  );
  if (!createResult.ok) return { ok: false, error: createResult.error };

  const itemResult = await adminRequest<Order>(
    `/orders/${createResult.data.id}/items`,
    adminJsonInit("POST", [{ menuItemId: appointment.treatmentMenuItemId, quantity: 1 }]),
    "Could not add the treatment line."
  );
  if (!itemResult.ok) {
    return { ok: true, orderId: createResult.data.id, itemAdded: false, itemError: itemResult.error };
  }

  return { ok: true, orderId: createResult.data.id, itemAdded: true };
}
