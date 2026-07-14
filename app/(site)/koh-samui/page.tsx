import ArtBlock from "@/components/ArtBlock";

export const metadata = { title: "Koh Samui — The Sunset Beach Resort & Spa" };

const attractions = [
  { file: "bigbuddha.jpg", label: "Big Buddha Temple" },
  { file: "hintahinyai.jpg", label: "Hin Ta Hin Yai Rocks" },
  { file: "na-muang-waterfall-koh-samui.jpg", label: "Na Muang Waterfall" },
  { file: "taling-ngam.jpg", label: "Taling Ngam" },
  { file: "elephant-ride.jpg", label: "Elephant Trekking" },
  { file: "snorking.jpg", label: "Snorkeling" },
  { file: "scubadiving.jpg", label: "Scuba Diving" },
  { file: "speedboat.jpg", label: "Speedboat Trips" },
  { file: "samuibungy.jpg", label: "Samui Bungy Jump" },
  { file: "golf.jpg", label: "Golf" },
  { file: "attractions-excursions-samui-buffalo-fighting.jpg", label: "Buffalo Fighting" },
];

export default function KohSamuiPage() {
  return (
    <section className="mx-auto max-w-5xl px-6 py-20">
      <p className="eyebrow text-sea mb-2 text-center">The island</p>
      <h1 className="font-display italic text-4xl text-center mb-10">Koh Samui</h1>
      <ArtBlock src="/images/koh-samui/taling-ngam.jpg" alt="Taling Ngam, Koh Samui" className="mb-8" priority />
      <div className="max-w-3xl mx-auto text-cream/75 leading-relaxed space-y-5">
        <p>
          Taling Ngam sits on the quiet south-west coast of Koh Samui, well away from the busier
          nightlife strips of Chaweng and Lamai — a serene base for exploring the Gulf of
          Thailand&rsquo;s nearby islands, or simply watching the sun go down over the water.
        </p>
        <p>
          Our team can help arrange transportation and excursions around the island for guests
          who want to venture further afield.
        </p>
      </div>

      <p className="eyebrow text-sea mb-2 text-center mt-16">Nearby</p>
      <h2 className="font-display italic text-2xl text-center mb-8">Attractions &amp; excursions</h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
        {attractions.map((a) => (
          <ArtBlock key={a.file} src={`/images/koh-samui/${a.file}`} alt={a.label} label={a.label} />
        ))}
      </div>
    </section>
  );
}
