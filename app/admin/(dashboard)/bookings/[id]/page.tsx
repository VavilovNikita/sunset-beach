import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import BookingStatusForm from "@/components/admin/BookingStatusForm";

export default async function AdminBookingDetailPage({ params }: { params: { id: string } }) {
  const booking = await prisma.booking.findUnique({
    where: { id: params.id },
    include: { room: true },
  });
  if (!booking) notFound();

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
            <span className="text-cream/40">Check-in:</span> {booking.checkIn.toISOString().slice(0, 10)}
          </p>
          <p>
            <span className="text-cream/40">Check-out:</span> {booking.checkOut.toISOString().slice(0, 10)}
          </p>
          <p>
            <span className="text-cream/40">Total:</span> ฿{Number(booking.totalPrice).toLocaleString("en-US")}
          </p>
          <p>
            <span className="text-cream/40">Booked on:</span> {booking.createdAt.toISOString().slice(0, 10)}
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
