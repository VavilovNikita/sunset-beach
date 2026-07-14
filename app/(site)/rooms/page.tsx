import BookingBar from "@/components/BookingBar";
import Horizon from "@/components/Horizon";
import ArtBlock from "@/components/ArtBlock";
import Image from "next/image";

export const metadata = { title: "Rooms & Villas — The Sunset Beach Resort & Spa" };

const rooms = [
  {
    name: "Sunset Jacuzzi SeaView",
    desc: "Enjoy stunning sunset views in a more spacious setting, with your own private jacuzzi facing the sea.",
    slug: "sunset-jacuzzi-seaview",
    photoCount: 3,
  },
  {
    name: "Garden Jacuzzi Villa",
    desc: "Each villa features a refreshing plunge pool and a private sala where you can relax or be pampered with a spa service. The jacuzzi sits beside the shower in your open-air bathroom.",
    slug: "garden-jacuzzi-villa",
    photoCount: 4,
  },
  {
    name: "Beachfront Villa",
    desc: "Simply and heartily decorated, with great comfort and a garden lounge area to watch the sunset and the sea.",
    slug: "beachfront-villa",
    photoCount: 4,
  },
  {
    name: "Beachfront Pool Villa",
    desc: "For the ultimate in luxury, our Beach Front Pool Villas offer over 250 square meters of private space, situated directly on the beach.",
    slug: "beachfront-pool-villa",
    photoCount: 4,
  },
];

export default function RoomsPage() {
  return (
    <>
      <section className="pt-16 pb-4 text-center px-6">
        <p className="eyebrow text-sea mb-2">Rooms &amp; Villas</p>
        <h1 className="font-display italic text-4xl">Discover our rooms</h1>
      </section>

      <BookingBar />

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
        {rooms.map((r) => (
          <article key={r.name}>
            <ArtBlock src={`/images/rooms/${r.slug}/01.jpg`} alt={r.name} tone="warm" />
            <div className="mt-2 grid grid-cols-3 gap-2">
              {Array.from({ length: r.photoCount - 1 }, (_, i) => i + 2).map((n) => (
                <div key={n} className="relative aspect-[4/3] rounded-lg overflow-hidden">
                  <Image
                    src={`/images/rooms/${r.slug}/0${n}.jpg`}
                    alt={`${r.name} — additional view`}
                    fill
                    sizes="15vw"
                    className="object-cover"
                  />
                </div>
              ))}
            </div>
            <h3 className="mt-4 font-display text-xl">{r.name}</h3>
            <p className="mt-2 text-sm text-cream/70 leading-relaxed">{r.desc}</p>
            <button className="mt-4 rounded-full border border-coral text-coral text-sm px-5 py-2 hover:bg-coral hover:text-cream transition-colors">
              Book Now
            </button>
          </article>
        ))}
      </section>
    </>
  );
}
