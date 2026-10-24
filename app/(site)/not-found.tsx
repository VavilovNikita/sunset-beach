import Link from "next/link";

// What notFound() renders inside the public site (an unknown room id, say): the site's own layout, navigation and
// footer around it, not the framework's bare 404.
export default function SiteNotFound() {
  return (
    <section className="mx-auto max-w-xl px-6 py-32 text-center">
      <p className="eyebrow text-sea mb-2">404</p>
      <h1 className="font-display italic text-4xl mb-4">This page could not be found</h1>
      <p className="text-cream/60 mb-8">The page may have moved, or the address is mistyped. You can look at our rooms or go back to the start.</p>
      <div className="flex flex-wrap justify-center gap-3">
        <Link href="/" className="rounded-full bg-coral hover:bg-coraldeep transition-colors px-6 py-2.5 text-sm font-medium">
          Home
        </Link>
        <Link href="/rooms" className="rounded-full border border-cream/25 hover:border-cream/50 transition-colors px-6 py-2.5 text-sm font-medium">
          Rooms
        </Link>
      </div>
    </section>
  );
}
