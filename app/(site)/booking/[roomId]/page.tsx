import { notFound } from "next/navigation";
import ArtBlock from "@/components/ArtBlock";
import RoomBookingPanel from "@/components/RoomBookingPanel";
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

      <RoomBookingPanel
        roomId={room.id}
        initialCheckIn={checkIn}
        initialCheckOut={checkOut}
        initialQuote={{ available, totalPrice }}
      />
    </section>
  );
}
