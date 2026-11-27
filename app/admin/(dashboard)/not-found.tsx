import Link from "next/link";
import { getSessionUser } from "@/lib/rbac";
import { staffHomeLink } from "@/lib/staffLanding";

// What notFound() renders inside the admin layout - a booking, order or anything else looked up by
// an id that doesn't exist (a stale link, a mistyped URL). Without this file Next fell back to its
// own root 404, a whole <html> document nested inside this layout's <div>: React refused to
// hydrate it and the page went blank with console errors instead of saying "not found".
//
// The button leads to the page this role starts on (lib/staffLanding.ts): the dashboard is not open to a waiter.
export default async function AdminNotFound() {
  const user = await getSessionUser();
  const home = staffHomeLink(user?.role, user?.functions);
  return (
    <div className="max-w-md">
      <p className="eyebrow text-sea mb-2">404</p>
      <h1 className="font-display italic text-3xl mb-4">This page could not be found</h1>
      <p className="text-sm text-cream/60 mb-8">
        Nothing exists at this address - the record may have been removed, or the link is mistyped.
      </p>
      <Link
        href={home.href}
        className="inline-block rounded-full bg-coral hover:bg-coraldeep transition-colors px-6 py-2.5 text-sm font-medium"
      >
        {home.label}
      </Link>
    </div>
  );
}
