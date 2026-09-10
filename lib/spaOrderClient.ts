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

export type BillSpaAppointmentResult = { ok: true; orderId: string } | { ok: false; error: string };

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

  // Best-effort: pre-filling the treatment as a line is a convenience on top of the link above,
  // not the guarantee this door provides - the explicit spaAppointmentId already linked the
  // order. If this fails, reception still lands on a real, linked order and can add the line by
  // hand there, the same AddOrderItemForm every order page already offers.
  await adminRequest<Order>(
    `/orders/${createResult.data.id}/items`,
    adminJsonInit("POST", [{ menuItemId: appointment.treatmentMenuItemId, quantity: 1 }]),
    "Could not add the treatment line."
  );

  return { ok: true, orderId: createResult.data.id };
}
