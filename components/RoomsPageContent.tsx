"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import BookingBar from "@/components/BookingBar";
import Horizon from "@/components/Horizon";
import ArtBlock from "@/components/ArtBlock";
import Lightbox, { type LightboxImage } from "@/components/Lightbox";
import { toDateKey, addDaysUTC } from "@/lib/bookings";
import { resolveImageUrl } from "@/lib/backend";
import type { Room } from "@/lib/types";

// /booking/[roomId] 404s without a valid checkIn < checkOut pair, so fall
// back to the same tomorrow/day-after default the search page (/booking)
// uses when the guest hasn't picked dates here yet.
function defaultDates() {
  const tomorrow = addDaysUTC(new Date(), 1);
  const dayAfter = addDaysUTC(tomorrow, 1);
  return { checkIn: toDateKey(tomorrow), checkOut: toDateKey(dayAfter) };
}

function bookingHref(roomId: string, checkIn: string, checkOut: string) {
  const dates = checkIn && checkOut && checkIn < checkOut ? { checkIn, checkOut } : defaultDates();
  return `/booking/${roomId}?checkIn=${dates.checkIn}&checkOut=${dates.checkOut}`;
}

type LightboxState = { images: LightboxImage[]; alt: string; index: number };

export default function RoomsPageContent({ rooms }: { rooms: Room[] }) {
  // Lifted out of BookingBar (controlled mode) so the room cards below can
  // carry over whatever dates the guest has already typed in, even if they
  // haven't hit "Check Availability" yet.
  const [checkIn, setCheckIn] = useState("");
  const [checkOut, setCheckOut] = useState("");
  const [lightbox, setLightbox] = useState<LightboxState | null>(null);

  return (
    <>
      <section className="pt-16 pb-16 text-center px-6">
        <p className="eyebrow text-sea mb-2">Rooms &amp; Villas</p>
        <h1 className="font-display italic text-4xl">Discover our rooms</h1>
      </section>

      <BookingBar
        checkIn={checkIn}
        checkOut={checkOut}
        onCheckInChange={setCheckIn}
        onCheckOutChange={setCheckOut}
      />

      <section className="mx-auto max-w-3xl px-6 py-16 text-cream/75 leading-relaxed space-y-5">
        <p>
          A luxury boutique resort and spa located directly on the beach front, commanding
          spectacular views of the Koh Samui coast and nearby islands, The Sunset Beach Resort
          &amp; Spa&rsquo;s superbly appointed beachfront villas and sunset rooms sit amidst our
          private, tranquil spa and gardens where the only sound is the gentle rhythm of the sea.
        </p>
        <p>
          The Sunset Beach Resort &amp; Spa, Taling Ngam offers 21 uniquely decorated rooms and
          villas. Sunset rooms are located above reception in a two-story building, garden villas
          are positioned around the swimming pool, and the beachfront villas sit right by the sand
          and sea.
        </p>
      </section>

      <Horizon />

      <section className="mx-auto max-w-6xl px-6 py-16 grid md:grid-cols-2 gap-10">
        {rooms.map((room) => {
          const href = bookingHref(room.id, checkIn, checkOut);
          // Order here is whatever /public/rooms returns — that array is the
          // canonical order (admin uploads only append/remove, there's no
          // separate reorder or cover-photo concept), so images[0] is always
          // the cover, same convention the /booking pages already rely on.
          const images: LightboxImage[] = room.images.map((path) => ({
            src: resolveImageUrl(path)!,
            unoptimized: path.startsWith("/uploads/"),
          }));
          const hasPhotos = images.length > 0;
          const openLightboxAt = (photoIndex: number) => {
            if (!hasPhotos) return;
            setLightbox({ images, alt: room.name, index: photoIndex });
          };

          return (
            <article key={room.id}>
              {hasPhotos ? (
                <button
                  type="button"
                  onClick={() => openLightboxAt(0)}
                  className="group block w-full text-left cursor-pointer"
                  aria-label={`View photos of ${room.name}`}
                >
                  <ArtBlock
                    src={images[0].src}
                    alt={room.name}
                    tone="warm"
                    unoptimized={images[0].unoptimized}
                    className="transition-all duration-300 group-hover:scale-[1.02] group-hover:brightness-90"
                  />
                </button>
              ) : (
                // No uploaded photos yet — plain placeholder, not clickable.
                <ArtBlock alt={room.name} tone="warm" />
              )}
              {images.length > 1 && (
                <div className="mt-2 grid grid-cols-3 gap-2">
                  {images.slice(1).map((img, i) => (
                    <button
                      key={img.src}
                      type="button"
                      onClick={() => openLightboxAt(i + 1)}
                      className="group relative aspect-[4/3] rounded-lg overflow-hidden block w-full cursor-pointer"
                      aria-label={`View photos of ${room.name}`}
                    >
                      <Image
                        src={img.src}
                        alt={`${room.name} — additional view`}
                        fill
                        sizes="15vw"
                        unoptimized={img.unoptimized}
                        className="object-cover transition-transform duration-300 group-hover:scale-110"
                      />
                      <div className="absolute inset-0 bg-ink/0 group-hover:bg-ink/20 transition-colors" />
                    </button>
                  ))}
                </div>
              )}
              <h3 className="mt-4 font-display text-xl">{room.name}</h3>
              <p className="mt-2 text-sm text-cream/70 leading-relaxed">{room.description}</p>
              <Link
                href={href}
                className="mt-4 inline-block rounded-full border border-coral text-coral text-sm px-5 py-2 hover:bg-coral hover:text-cream transition-colors"
              >
                Book Now
              </Link>
            </article>
          );
        })}
      </section>

      {lightbox && (
        <Lightbox
          images={lightbox.images}
          alt={lightbox.alt}
          index={lightbox.index}
          onIndexChange={(index) => setLightbox((prev) => (prev ? { ...prev, index } : prev))}
          onClose={() => setLightbox(null)}
        />
      )}
    </>
  );
}
