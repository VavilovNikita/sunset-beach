import BookingBar from "@/components/BookingBar";

export const metadata = { title: "About Us — The Sunset Beach Resort & Spa" };

export default function AboutPage() {
  return (
    <>
      <section className="pt-16 pb-4 text-center px-6">
        <p className="eyebrow text-sea mb-2">Our story</p>
        <h1 className="font-display italic text-4xl">About Us</h1>
      </section>

      <BookingBar />

      <section className="mx-6 md:mx-auto md:max-w-5xl mt-8 rounded-2xl overflow-hidden">
        <video
          className="w-full h-auto"
          src="/videos/about.mp4"
          poster="/images/gallery/20.jpg"
          controls
          playsInline
          preload="metadata"
        >
          Your browser does not support the video tag.
        </video>
      </section>

      <section className="mx-auto max-w-3xl px-6 py-16 text-cream/75 leading-relaxed space-y-5">
        <p>
          A luxury boutique resort and spa located directly on the beach front, commanding
          spectacular views of the Koh Samui coast and nearby islands, The Sunset Beach Resort
          &amp; Spa&rsquo;s superbly appointed beachfront villas and sunset rooms sit amidst our
          private, tranquil spa and gardens where the only sound is the gentle rhythm of the sea.
        </p>
        <p>
          The Sunset Beach Resort &amp; Spa, Taling Ngam offers 21 uniquely decorated rooms and
          villas. Sunset rooms are located above reception in a two-story building. Garden villas
          are positioned around the swimming pool, and of course the beachfront villas are right
          by the sand and sea.
        </p>
        <p>
          All rooms and villas are designed to implement modern art with the beauty of nature.
          The decorations and facilities are based on woods to keep the balance of nature, yet
          keep the comfort of high-technology facilities.
        </p>
      </section>
    </>
  );
}
