import type { Metadata } from "next";
import { fraunces, worksans } from "@/lib/fonts";
import "../globals.css";

// This app has no app/layout.tsx — each top-level segment renders its own <html>/<body> instead
// of sharing one root layout (see app/guest/layout.tsx's own comment, the same pattern this
// mirrors). /login is its own segment rather than living under (site) or /guest: it's a combined
// entry point that redirects into either the staff (/admin) or guest (/guest/account) area
// depending on which login succeeds, so it belongs to neither on its own.
export const metadata: Metadata = {
  title: "Sign in — The Sunset Beach Resort & Spa",
  robots: { index: false, follow: false },
};

export default function LoginLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${fraunces.variable} ${worksans.variable}`}>
      <body className="font-body bg-ink text-cream antialiased min-h-screen">{children}</body>
    </html>
  );
}
