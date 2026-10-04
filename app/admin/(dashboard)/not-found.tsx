import Link from "next/link";

// What notFound() renders inside the admin layout - a booking, order or anything else looked up by
// an id that doesn't exist (a stale link, a mistyped URL). Without this file Next fell back to its
// own root 404, a whole <html> document nested inside this layout's <div>: React refused to
// hydrate it and the page went blank with console errors instead of saying "not found".
export default function AdminNotFound() {
  return (
    <div className="max-w-md">
      <p className="eyebrow text-sea mb-2">404</p>
      <h1 className="font-display italic text-3xl mb-4">This page could not be found</h1>
      <p className="text-sm text-cream/60 mb-8">
        Nothing exists at this address - the record may have been removed, or the link is mistyped.
      </p>
      <Link
        href="/admin"
        className="inline-block rounded-full bg-coral hover:bg-coraldeep transition-colors px-6 py-2.5 text-sm font-medium"
      >
        Go to Dashboard
      </Link>
    </div>
  );
}
