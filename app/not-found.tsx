import Link from "next/link";
import { fraunces, worksans } from "@/lib/fonts";
import "./globals.css";

// An address that matches no route at all (/nothing-here). This app has no root layout - each section renders its own
// <html> - so the unmatched-URL page has to bring its own, in the site's look. A missing record inside a section is
// that section's own not-found.tsx (the site's, and the admin's inside its frame).
export default function RootNotFound() {
  return (
    <html lang="en" className={`${fraunces.variable} ${worksans.variable}`}>
      <body className="font-body bg-ink text-cream antialiased min-h-screen flex items-center justify-center px-6">
        <div className="max-w-md text-center">
          <p className="eyebrow text-sea mb-2">404</p>
          <h1 className="font-display italic text-4xl mb-4">This page could not be found</h1>
          <p className="text-cream/60 mb-8">The address does not exist on The Sunset Beach site.</p>
          <Link href="/" className="inline-block rounded-full bg-coral hover:bg-coraldeep transition-colors px-6 py-2.5 text-sm font-medium">
            Back to the home page
          </Link>
        </div>
      </body>
    </html>
  );
}
