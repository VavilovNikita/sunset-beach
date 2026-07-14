import { Resend } from "resend";
import type { Booking, Room } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { toDateKey } from "@/lib/bookings";

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
const FROM = process.env.EMAIL_FROM || "The Sunset Beach Resort & Spa <bookings@sunsetbeach.example>";
const SITE_URL = process.env.NEXTAUTH_URL ?? "";

// No RESEND_API_KEY in dev? Log the email instead of sending, so the booking
// flow works out of the box without an email provider configured.
async function send(to: string | string[], subject: string, html: string) {
  if (!resend) {
    console.log(`[email:dev-log] to=${Array.isArray(to) ? to.join(", ") : to} subject="${subject}"\n${html}`);
    return;
  }
  await resend.emails.send({ from: FROM, to, subject, html });
}

type BookingWithRoom = Booking & { room: Room };

// Failures here must never break the booking create/update flow they're
// called from, so every email dispatch is caught and logged, not thrown.
export async function sendNewBookingEmail(booking: BookingWithRoom) {
  try {
    const staff = await prisma.user.findMany({ select: { email: true } });
    const to = staff.map((u) => u.email);
    if (to.length === 0) return;

    await send(
      to,
      `New booking request — ${booking.room.name}`,
      `<p>New booking request received.</p>
       <ul>
         <li>Room: ${booking.room.name}</li>
         <li>Guest: ${booking.guestName} (${booking.guestEmail}, ${booking.guestPhone})</li>
         <li>Check-in: ${toDateKey(booking.checkIn)}</li>
         <li>Check-out: ${toDateKey(booking.checkOut)}</li>
         <li>Total: ฿${Number(booking.totalPrice).toLocaleString("en-US")}</li>
       </ul>
       <p><a href="${SITE_URL}/admin/bookings/${booking.id}">View in admin</a></p>`
    );
  } catch (err) {
    console.error("sendNewBookingEmail failed:", err);
  }
}

export async function sendGuestStatusEmail(booking: BookingWithRoom) {
  if (booking.status !== "PAID" && booking.status !== "CANCELLED") return;

  try {
    const stay = `${booking.room.name} (${toDateKey(booking.checkIn)} → ${toDateKey(booking.checkOut)})`;
    const subject =
      booking.status === "PAID"
        ? `Your booking is confirmed & paid — ${booking.room.name}`
        : `Your booking has been cancelled — ${booking.room.name}`;
    const html =
      booking.status === "PAID"
        ? `<p>Hi ${booking.guestName},</p><p>Your payment for ${stay} has been received. We look forward to welcoming you!</p>`
        : `<p>Hi ${booking.guestName},</p><p>Your booking for ${stay} has been cancelled. If you have questions, just reply to this email.</p>`;

    await send(booking.guestEmail, subject, html);
  } catch (err) {
    console.error("sendGuestStatusEmail failed:", err);
  }
}
