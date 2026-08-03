import Link from "next/link";
import BookingBar from "@/components/BookingBar";
import ArtBlock from "@/components/ArtBlock";
import { backendJson } from "@/lib/backendServer";
import { resolveImageUrl } from "@/lib/backend";
import { toDateKey, addDaysUTC } from "@/lib/bookings";
import { getRoomQuote } from "@/lib/publicQuote";
import type { Room } from "@/lib/types";

export const metadata = { title: "Check availability — The Sunset Beach Resort & Spa" };

function defaultDates() {
  const tomorrow = addDaysUTC(new Date(), 1);
  const dayAfter = addDaysUTC(tomorrow, 1);
  return { checkIn: toDateKey(tomorrow), checkOut: toDateKey(dayAfter) };
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export default async function BookingSearchPage({
  searchParams,
}: {
  searchParams: { checkIn?: string; checkOut?: string };
}) {
  const fallback = defaultDates();
  const checkIn =
    searchParams.checkIn && ISO_DATE.test(searchParams.checkIn) ? searchParams.checkIn : fallback.checkIn;
  const checkOut =
    searchParams.checkOut && ISO_DATE.test(searchParams.checkOut) ? searchParams.checkOut : fallback.checkOut;
  const validRange = checkIn < checkOut;

  const rooms = validRange ? await backendJson<Room[]>("/public/rooms") : [];

  const results = validRange
    ? await Promise.all(
        rooms.map(async (room) => {
          const { available, totalPrice } = await getRoomQuote(room.id, checkIn, checkOut);
          return { room, available, totalPrice };
        })
      )
    : [];

  return (
    <>
      <section className="pt-16 pb-4 text-center px-6">
        <p className="eyebrow text-sea mb-2">Check availability</p>
        <h1 className="font-display italic text-4xl">Find your stay</h1>
      </section>

      <BookingBar />

      <section className="mx-auto max-w-6xl px-6 py-16">
        {!validRange ? (
          <p className="text-center text-coral">Check-out must be after check-in. Please adjust your dates above.</p>
        ) : (
          <>
            <p className="text-center text-cream/60 text-sm mb-10">
              {checkIn} → {checkOut}
            </p>
            <div className="grid md:grid-cols-2 gap-10">
              {results.map(({ room, available, totalPrice }) => (
                <article key={room.id} className={!available ? "opacity-50" : ""}>
                  <ArtBlock
                    src={resolveImageUrl(room.images[0])}
                    alt={room.name}
                    tone="warm"
                    unoptimized={room.images[0]?.startsWith("/uploads/")}
                  />
                  <h3 className="mt-4 font-display text-xl">{room.name}</h3>
                  <p className="mt-2 text-sm text-cream/70 leading-relaxed">{room.description}</p>
                  <p className="mt-2 text-sm text-cream/60">Up to {room.capacity} guests</p>

                  {available ? (
                    <>
                      <p className="mt-3 font-display text-lg text-coral">฿{totalPrice?.toLocaleString("en-US")} total</p>
                      <Link
                        href={`/booking/${room.id}?checkIn=${checkIn}&checkOut=${checkOut}`}
                        className="mt-4 inline-block rounded-full bg-coral hover:bg-coraldeep transition-colors text-cream text-sm px-5 py-2"
                      >
                        Book this room
                      </Link>
                    </>
                  ) : (
                    <p className="mt-3 text-sm text-cream/50">Not available for these dates</p>
                  )}
                </article>
              ))}
            </div>
          </>
        )}
      </section>
    </>
  );
}
