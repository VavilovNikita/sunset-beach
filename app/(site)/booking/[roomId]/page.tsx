import { notFound } from "next/navigation";
import ArtBlock from "@/components/ArtBlock";
import BookingGuestForm from "@/components/BookingGuestForm";
import Link from "next/link";
import { backendJson } from "@/lib/backendServer";
import { BackendError, resolveImageUrl } from "@/lib/backend";
import { getRoomQuote } from "@/lib/publicQuote";
import type { Room } from "@/lib/types";

export const metadata = { title: "Confirm your stay — The Sunset Beach Resort & Spa" };

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export default async function BookRoomPage({
  params,
  searchParams,
}: {
  params: { roomId: string };
  searchParams: { checkIn?: string; checkOut?: string };
}) {
  const { checkIn, checkOut } = searchParams;
  if (!checkIn || !checkOut || !ISO_DATE.test(checkIn) || !ISO_DATE.test(checkOut) || checkIn >= checkOut) {
    notFound();
  }

  let room: Room;
  try {
    room = await backendJson<Room>(`/public/rooms/${params.roomId}`);
  } catch (e) {
    if (e instanceof BackendError && e.status === 404) notFound();
    throw e;
  }

  const { available, totalPrice } = await getRoomQuote(room.id, checkIn, checkOut);

  return (
    <section className="mx-auto max-w-3xl px-6 py-16">
      <p className="eyebrow text-sea mb-2 text-center">Confirm your stay</p>
      <h1 className="font-display italic text-4xl text-center mb-10">{room.name}</h1>

      <ArtBlock
        src={resolveImageUrl(room.images[0])}
        alt={room.name}
        tone="warm"
        className="mb-6"
        unoptimized={room.images[0]?.startsWith("/uploads/")}
      />

      <div className="grid sm:grid-cols-3 gap-4 text-center mb-10">
        <div>
          <p className="eyebrow text-cream/40">Check-in</p>
          <p className="mt-1">{checkIn}</p>
        </div>
        <div>
          <p className="eyebrow text-cream/40">Check-out</p>
          <p className="mt-1">{checkOut}</p>
        </div>
        <div>
          <p className="eyebrow text-cream/40">Total</p>
          <p className="mt-1 text-coral font-display text-lg">฿{totalPrice?.toLocaleString("en-US")}</p>
        </div>
      </div>

      {available ? (
        <BookingGuestForm roomId={room.id} checkIn={checkIn} checkOut={checkOut} />
      ) : (
        <p className="text-center text-coral">
          Sorry, this room is no longer available for those dates.{" "}
          <Link href={`/booking?checkIn=${checkIn}&checkOut=${checkOut}`} className="underline underline-offset-4">
            See other rooms
          </Link>
        </p>
      )}
    </section>
  );
}
