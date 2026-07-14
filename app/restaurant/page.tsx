import BookingBar from "@/components/BookingBar";
import Horizon from "@/components/Horizon";
import ArtBlock from "@/components/ArtBlock";

export const metadata = { title: "Restaurant — The Sunset Beach Resort & Spa" };

export default function RestaurantPage() {
  return (
    <>
      <section className="pt-16 pb-4 text-center px-6">
        <p className="eyebrow text-sea mb-2">Dining</p>
        <h1 className="font-display italic text-4xl">L&rsquo;Ananas Restaurant &amp; Bar</h1>
      </section>

      <BookingBar />

      <section className="mx-auto max-w-5xl px-6 py-16 space-y-16">
        <article>
          <p className="text-cream/75 leading-relaxed max-w-2xl">
            Thailand, and Koh Samui in particular, has a spectacular range of fresh indigenous
            produce, and at Restaurant L&rsquo;Ananas we make the most of it. Stop at the
            Lilavadee Bar for a drink and a bite to eat, or drop into L&rsquo;Ananas for a meal —
            or let us arrange a private dinner for two on the beach.
          </p>
          <div className="mt-8 grid sm:grid-cols-3 gap-4">
            <ArtBlock src="/images/restaurants-bar/01.jpg" alt="L'Ananas Restaurant & Bar" tone="warm" />
            <ArtBlock src="/images/restaurants-bar/02.jpg" alt="L'Ananas Restaurant & Bar" tone="deep" />
            <ArtBlock src="/images/restaurants-bar/03.jpg" alt="L'Ananas Restaurant & Bar" tone="sand" />
          </div>
        </article>

        <Horizon />

        <article>
          <h2 className="font-display italic text-2xl mb-4">Stylish Dining</h2>
          <p className="text-cream/75 leading-relaxed max-w-2xl">
            From a table overlooking the resort out towards the Gulf of Thailand, commanding
            spectacular views of the nearby islands and stunning sunsets, you can experience
            modern Thai cuisine and a range of international and spa dishes — delicious, and
            carefully prepared to be healthy too. Choose from eight different mineral waters,
            countless teas, freshly squeezed juices, smoothies, and over 50 wines from the old
            and new world.
          </p>
          <div className="mt-8 grid sm:grid-cols-2 gap-4 max-w-xl">
            <ArtBlock src="/images/restaurants-bar/04.jpg" alt="Dining overlooking the Gulf of Thailand" tone="deep" />
            <ArtBlock src="/images/restaurants-bar/05.jpg" alt="Dining overlooking the Gulf of Thailand" tone="warm" />
          </div>
        </article>

        <Horizon />

        <article>
          <h2 className="font-display italic text-2xl mb-4">Thai Food at L&rsquo;Ananas</h2>
          <p className="text-cream/75 leading-relaxed max-w-2xl">
            Thai cuisine is known for its balance of five fundamental flavors in each dish — hot,
            sour, sweet, salty and bitter — using many local herbs, light, tasty and healthy. Visit
            our herbal garden in the resort, and enjoy tropical seasonal fruits at their best.
          </p>
          <p className="mt-4 text-cream/75 leading-relaxed max-w-2xl">
            Choose from L&rsquo;Ananas, our all-day dining restaurant overlooking the resort and
            the sea, or the Lilavadee Pool Bar for a refreshing drink, snack or meal. Room service
            is available from 6:30 a.m. to 10:30 p.m., with a wine list of imported wines served
            by the glass and by the bottle.
          </p>
          <div className="mt-8 grid sm:grid-cols-2 gap-4 max-w-xl">
            <ArtBlock src="/images/restaurants-bar/06.jpg" alt="Thai cuisine at L'Ananas" tone="sand" />
            <ArtBlock src="/images/restaurants-bar/07.jpg" alt="Thai cuisine at L'Ananas" tone="warm" />
          </div>
        </article>
      </section>
    </>
  );
}
