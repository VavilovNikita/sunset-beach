import BookingBar from "@/components/BookingBar";
import Horizon from "@/components/Horizon";
import ArtBlock from "@/components/ArtBlock";
import Image from "next/image";
import Link from "next/link";

export default function Home() {
  return (
    <>
      <section className="relative h-[560px] flex items-end overflow-hidden">
        <Image
          src="/images/gallery/20.jpg"
          alt="Sunset over the private pool villas at The Sunset Beach Resort & Spa"
          fill
          priority
          sizes="100vw"
          className="object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-ink via-ink/40 to-ink/10" />
        <div className="relative z-10 mx-auto max-w-4xl px-6 pb-16 text-center w-full">
          <p className="eyebrow text-cream/80 mb-4">Taling Ngam · South-West Koh Samui</p>
          <h1 className="font-display italic text-4xl md:text-6xl leading-tight">
            The Sunset Beach Resort &amp; Spa
          </h1>
          <p className="mt-4 text-cream/85 max-w-xl mx-auto">
            A secluded beach with spectacular sunsets — far from the busy tourist strips of
            Chaweng and Lamai, this remains the authentic Koh Samui.
          </p>
        </div>
      </section>

      <BookingBar />

      <section className="mx-auto max-w-3xl px-6 py-20 text-center">
        <h2 className="font-display italic text-2xl md:text-3xl text-cream">
          Welcome to The Sunset Beach Resort &amp; Spa
        </h2>
        <div className="mt-6 space-y-5 text-cream/75 text-left leading-relaxed">
          <p>Dear Valued Guests,</p>
          <p>
            It is with great pleasure that we invite you to experience the soft opening of The
            Sunset Beach, a cherished family business where every guest is treated like family.
            As we embark on this new chapter, we are dedicated to providing you with an
            exceptional stay, even during our soft opening phase.
          </p>
          <p>
            While our full L&rsquo;Ananas Restaurant is not yet operational, we have created a
            special small menu for you to savor, with a selection of beverages in a relaxed
            setting at our Pool Bar. Our fitness center is open for your convenience, and while
            the spa is not fully operational, we are happy to arrange massage treatments on
            request.
          </p>
          <p>
            Our private beach offers a tranquil escape, where you can soak up the sun and the
            sunset in peace and privacy.
          </p>
          <p>Warm regards,<br />Müller Family</p>
        </div>
      </section>

      <Horizon />

      <section className="mx-auto max-w-6xl px-6 pb-20">
        <p className="eyebrow text-sea text-center mb-2">Discover the resort</p>
        <h2 className="font-display italic text-3xl text-center mb-10">Three ways to unwind</h2>
        <div className="grid md:grid-cols-3 gap-6">
          {[
            { href: "/rooms", label: "Villas & sunset rooms", src: "/images/rooms/beachfront-pool-villa/01.jpg", desc: "21 uniquely decorated rooms and villas set among private gardens." },
            { href: "/spa", label: "The Sunset Beach Spa", src: "/images/spa/01.jpg", desc: "Four sauna-world climate zones and open-air treatment salas." },
            { href: "/restaurant", label: "L'Ananas Restaurant & Bar", src: "/images/restaurants-bar/01.jpg", desc: "Modern Thai cuisine overlooking the Gulf of Thailand." },
          ].map((c) => (
            <Link key={c.href} href={c.href} className="group block">
              <ArtBlock src={c.src} alt={c.label} tone="warm" />
              <h3 className="mt-4 font-display text-lg group-hover:text-coral transition-colors">{c.label}</h3>
              <p className="mt-1 text-sm text-cream/65">{c.desc}</p>
            </Link>
          ))}
        </div>
      </section>
    </>
  );
}
