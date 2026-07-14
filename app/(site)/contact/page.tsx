import BookingBar from "@/components/BookingBar";
import ContactForm from "@/components/ContactForm";

export const metadata = { title: "Contact — The Sunset Beach Resort & Spa" };

export default function ContactPage() {
  return (
    <>
      <section className="pt-16 pb-4 text-center px-6">
        <p className="eyebrow text-sea mb-2">Get in touch</p>
        <h1 className="font-display italic text-4xl">Contact Us</h1>
      </section>

      <BookingBar />

      <section className="mx-auto max-w-5xl px-6 py-16 grid md:grid-cols-2 gap-12">
        <div>
          <h2 className="font-display text-xl mb-4">The Sunset Beach Resort &amp; Spa</h2>
          <address className="not-italic text-cream/75 leading-relaxed">
            126/9 Moo 3, Taling Ngam, Samui 84140, Thailand
          </address>
          <p className="mt-4 text-cream/75">
            Tel: <strong className="text-cream">+66 77 428 200</strong>
          </p>
          <p className="text-cream/75">
            Fax: <strong className="text-cream">+66 77 428 250</strong>
          </p>
          <p className="mt-4 text-cream/75">
            Email:{" "}
            <a href="mailto:reservation@thesunsetbeachresort.com" className="text-coral">
              reservation@thesunsetbeachresort.com
            </a>
          </p>
          <p className="mt-6 text-cream/75 leading-relaxed">
            By the time you have to leave The Sunset Beach Resort &amp; Spa, you won&rsquo;t just
            look great on the outside — you&rsquo;ll feel great on the inside too.
          </p>
        </div>

        <ContactForm />
      </section>

      <section className="mx-auto max-w-5xl px-6 pb-20">
        <h2 className="font-display italic text-2xl mb-4">Map</h2>
        <p className="text-cream/75 leading-relaxed max-w-2xl mb-6">
          We are located on a beautiful beachfront in Taling Ngam, Koh Samui, on the south-west
          side of the island — a quiet, serene area for a relaxing holiday, far from the busier
          nightlife of Chaweng and Lamai. We can organize transportation if you want to venture
          out; just ask one of our team members.
        </p>
        <div className="rounded-xl overflow-hidden border border-cream/10">
          <iframe
            src="https://www.google.com/maps/embed?pb=!1m14!1m8!1m3!1d31484.098562198327!2d99.933617!3d9.464089!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x0%3A0xf1777ab4ab62559d!2sThe+Sunset+Beach+Resort+%26+Spa%2C+Taling+Ngam!5e0!3m2!1sen!2sth!4v1526031245845"
            width="100%"
            height="420"
            loading="lazy"
            style={{ border: 0 }}
          />
        </div>
      </section>
    </>
  );
}
