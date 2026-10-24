import { notFound } from "next/navigation";
import ArtBlock from "@/components/ArtBlock";
import RoomBookingPanel from "@/components/RoomBookingPanel";
import { backendJson } from "@/lib/backendServer";
import { BackendError, resolveImageUrl } from "@/lib/backend";
import { getRoomQuote } from "@/lib/publicQuote";
import { getGuestSessionAccount } from "@/lib/guestRbac";
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

  const [initialQuote, account] = await Promise.all([
    getRoomQuote(room.id, checkIn, checkOut),
    getGuestSessionAccount(),
  ]);
  // Only what the form prefills - not the whole account, which would otherwise be serialized
  // into the client component's props.
  const guestAccount = account ? { name: account.name, email: account.email } : null;

  return (
    <section className="mx-auto max-w-5xl px-6 py-10 md:py-14">
      <p className="eyebrow text-sea mb-2 text-center md:text-left">Confirm your stay</p>
      <h1 className="font-display italic text-4xl text-center md:text-left mb-8">{room.name}</h1>

      {/* Two columns from md up so the form is on the first screen: the photo and the room's facts beside it
          rather than above it. */}
      <div className="grid md:grid-cols-5 gap-8 items-start">
        <div className="md:col-span-2">
          <ArtBlock
            src={resolveImageUrl(room.images[0])}
            alt={room.name}
            tone="warm"
            unoptimized={room.images[0]?.startsWith("/uploads/")}
          />
          <p className="mt-4 text-sm text-cream/60">
            Sleeps up to {room.capacity} &middot; from &#3647;{Number(room.basePrice).toLocaleString("en-US")} per night
          </p>
        </div>
        <div className="md:col-span-3">
          <RoomBookingPanel
            roomId={room.id}
            initialCheckIn={checkIn}
            initialCheckOut={checkOut}
            initialQuote={initialQuote}
            guestAccount={guestAccount}
            capacity={room.capacity}
            basePrice={room.basePrice}
          />
        </div>
      </div>
    </section>
  );
}
