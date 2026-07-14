import BookingBar from "@/components/BookingBar";
import ArtBlock from "@/components/ArtBlock";
import Image from "next/image";
import Link from "next/link";

export const metadata = { title: "Weddings & Events — The Sunset Beach Resort & Spa" };

export default function WeddingsPage() {
  return (
    <>
      <section className="pt-16 pb-4 text-center px-6">
        <p className="eyebrow text-sea mb-2">Celebrations</p>
        <h1 className="font-display italic text-4xl">Weddings &amp; Events</h1>
      </section>

      <BookingBar />

      <section className="relative h-[360px] mx-6 md:mx-auto md:max-w-5xl mt-4 rounded-2xl overflow-hidden">
        <Image
          src="/images/weddings-events/weddings-01.jpg"
          alt="Newlyweds watching the sunset on the beach at The Sunset Beach Resort & Spa"
          fill
          sizes="(min-width: 768px) 80vw, 100vw"
          className="object-cover"
        />
      </section>

      <section className="mx-auto max-w-4xl px-6 py-16 text-center">
        <p className="text-cream/75 max-w-xl mx-auto leading-relaxed">
          Looking to get married in Thailand? We can organize and cater for your wedding on our
          private beach, with the Gulf of Thailand and a spectacular sunset as your backdrop.
        </p>

        <div className="mt-10 grid sm:grid-cols-2 gap-6 text-left">
          <ArtBlock src="/images/weddings-events/weddings-02.jpg" alt="Romance package suite" tone="warm" label="Beach ceremony" />
          <div className="flex items-center justify-center bg-sand/10 border border-cream/10 rounded-xl p-8">
            <p className="font-display italic text-lg">
              Please{" "}
              <Link href="/contact" className="text-coral underline underline-offset-4">
                contact us
              </Link>{" "}
              for more information.
            </p>
          </div>
        </div>
      </section>
    </>
  );
}
