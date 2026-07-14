import BookingBar from "@/components/BookingBar";
import Horizon from "@/components/Horizon";
import ArtBlock from "@/components/ArtBlock";

export const metadata = { title: "Spa — The Sunset Beach Resort & Spa" };

export default function SpaPage() {
  return (
    <>
      <section className="pt-16 pb-4 text-center px-6">
        <p className="eyebrow text-sea mb-2">Wellness</p>
        <h1 className="font-display italic text-4xl">The Sunset Beach Spa</h1>
      </section>

      <BookingBar />

      <section className="mx-auto max-w-5xl px-6 py-16 space-y-16">
        <article>
          <p className="text-cream/75 leading-relaxed max-w-2xl">
            Holidays are for relaxing, and at The Sunset Beach Resort &amp; Spa you can experience
            rejuvenation as well. Enjoy the renewing treatments of our day spa in your private
            villa sala, or visit our double spa suites with private open-air bathroom and tropical
            paradise garden.
          </p>
          <div className="mt-8 grid sm:grid-cols-3 gap-4">
            <ArtBlock src="/images/spa/01.jpg" alt="Sunset Beach Spa treatment sala" tone="deep" />
            <ArtBlock src="/images/spa/02.jpg" alt="Sunset Beach Spa treatment sala" tone="warm" />
            <ArtBlock src="/images/spa/03.jpg" alt="Sunset Beach Spa treatment sala" tone="sand" />
          </div>
        </article>

        <Horizon />

        <article>
          <p className="text-cream/75 leading-relaxed max-w-2xl">
            Our sauna world has four different climate zones — hot &amp; wet, ice cave, hot &amp;
            dry, warm. Chill out with aroma &amp; sound and the ice pool, complimentary for spa
            resort guests. With three private salas, there is plenty of space to enjoy your
            choice of luxurious spa services.
          </p>
          <div className="mt-8 grid sm:grid-cols-3 gap-4">
            <ArtBlock src="/images/spa/04.jpg" alt="Sunset Beach Spa sauna world" tone="deep" />
            <ArtBlock src="/images/spa/05.jpg" alt="Sunset Beach Spa sauna world" tone="warm" />
            <ArtBlock src="/images/spa/06.jpg" alt="Sunset Beach Spa sauna world" tone="sand" />
          </div>
        </article>

        <Horizon />

        <article>
          <p className="text-cream/75 leading-relaxed max-w-2xl">
            From relaxation massage and classic Thai massage to body scrubs, facials, detox and
            aromatherapy, body and face masques, anti-aging treatments and healthy food options —
            there are so many choices, and all will leave you relaxed and radiant.
          </p>
          <div className="mt-8 grid sm:grid-cols-2 gap-4 max-w-xl">
            <ArtBlock src="/images/spa/07.jpg" alt="Sunset Beach Spa treatment" tone="warm" />
            <ArtBlock src="/images/spa/08.jpg" alt="Sunset Beach Spa treatment" tone="sand" />
          </div>
        </article>
      </section>
    </>
  );
}
