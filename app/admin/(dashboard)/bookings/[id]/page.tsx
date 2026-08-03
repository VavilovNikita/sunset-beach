import { notFound } from "next/navigation";
import { backendJson } from "@/lib/backendServer";
import { BackendError } from "@/lib/backend";
import BookingStatusForm from "@/components/admin/BookingStatusForm";
import type { Booking } from "@/lib/types";

export default async function AdminBookingDetailPage({ params }: { params: { id: string } }) {
  let booking: Booking;
  try {
    booking = await backendJson<Booking>(`/bookings/${params.id}`, { auth: true });
  } catch (e) {
    if (e instanceof BackendError && e.status === 404) notFound();
    throw e;
  }

  return (
    <div>
      <p className="eyebrow text-sea mb-2">Reservation</p>
      <h1 className="font-display italic text-3xl mb-8">{booking.guestName}</h1>

      <div className="grid md:grid-cols-2 gap-8">
        <div className="space-y-2 text-sm">
          <p>
            <span className="text-cream/40">Room:</span> {booking.room.name}
          </p>
          <p>
            <span className="text-cream/40">Email:</span> {booking.guestEmail}
          </p>
          <p>
            <span className="text-cream/40">Phone:</span> {booking.guestPhone}
          </p>
          <p>
            <span className="text-cream/40">Check-in:</span> {booking.checkIn.slice(0, 10)}
          </p>
          <p>
            <span className="text-cream/40">Check-out:</span> {booking.checkOut.slice(0, 10)}
          </p>
          <p>
            <span className="text-cream/40">Total:</span> ฿{Number(booking.totalPrice).toLocaleString("en-US")}
          </p>
          <p>
            <span className="text-cream/40">Booked on:</span> {booking.createdAt.slice(0, 10)}
          </p>
        </div>

        <BookingStatusForm
          bookingId={booking.id}
          currentStatus={booking.status}
          currentPaymentNote={booking.paymentNote}
        />
      </div>
    </div>
  );
}
