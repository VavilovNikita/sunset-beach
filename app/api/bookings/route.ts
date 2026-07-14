import { NextResponse, type NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { bookingCreateSchema } from "@/lib/validation";
import { parseDateKey, isRangeAvailable, computeTotalPrice, BookingConflictError } from "@/lib/bookings";
import { sendNewBookingEmail } from "@/lib/email";

// Intentionally unauthenticated — guests aren't logged in. The server
// recomputes totalPrice and re-validates availability itself; nothing the
// client sends about price/availability is trusted.
export async function POST(req: NextRequest) {
  const body = await req.json();
  const parsed = bookingCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { roomId, guestName, guestEmail, guestPhone, checkIn, checkOut } = parsed.data;
  const checkInDate = parseDateKey(checkIn);
  const checkOutDate = parseDateKey(checkOut);

  const room = await prisma.room.findUnique({ where: { id: roomId } });
  if (!room) return NextResponse.json({ error: "Room not found" }, { status: 404 });

  try {
    const booking = await prisma.$transaction(
      async (tx) => {
        const available = await isRangeAvailable(tx, roomId, checkInDate, checkOutDate);
        if (!available) throw new BookingConflictError();

        const totalPrice = await computeTotalPrice(tx, roomId, checkInDate, checkOutDate);

        return tx.booking.create({
          data: {
            roomId,
            guestName,
            guestEmail,
            guestPhone,
            checkIn: checkInDate,
            checkOut: checkOutDate,
            totalPrice: totalPrice ?? 0,
            status: "NEW",
          },
          include: { room: true },
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );

    await sendNewBookingEmail(booking);

    return NextResponse.json(booking, { status: 201 });
  } catch (e) {
    if (e instanceof BookingConflictError) {
      return NextResponse.json({ error: e.message }, { status: 409 });
    }
    // Postgres serialization failure under concurrent conflicting requests.
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2034") {
      return NextResponse.json(
        { error: "Someone just booked these dates — please try again." },
        { status: 409 }
      );
    }
    throw e;
  }
}
