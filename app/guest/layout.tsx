import type { Metadata } from "next";
import { fraunces, worksans } from "@/lib/fonts";
import "../globals.css";

// This app has no app/layout.tsx — each top-level segment renders its own <html>/<body> instead
// of sharing one root layout (see app/order/layout.tsx's own comment, the same pattern this
// mirrors). A guest managing their own persistent account is a different audience again from a
// guest scanning a table QR code (app/order) — deliberately its own segment, not folded into
// either that one or the public (site) marketing/booking pages: this is a signed-in area (see
// lib/guestRbac.ts), just never staff, so it gets no admin/pos sidebar either.
export const metadata: Metadata = {
  title: "Your account — The Sunset Beach Resort & Spa",
  robots: { index: false, follow: false },
};

export default function GuestAccountLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${fraunces.variable} ${worksans.variable}`}>
      <body className="font-body bg-ink text-cream antialiased min-h-screen">{children}</body>
    </html>
  );
}
