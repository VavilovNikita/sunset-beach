import type { Metadata } from "next";
import { fraunces, worksans } from "@/lib/fonts";
import "../globals.css";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import { getGuestSessionAccount } from "@/lib/guestRbac";
import { getSessionUser } from "@/lib/rbac";

export const metadata: Metadata = {
  title: "The Sunset Beach Resort & Spa — Taling Ngam, Koh Samui",
  description:
    "A secluded beachfront boutique resort on the quiet south-west coast of Koh Samui, far from Chaweng and Lamai — spectacular sunsets, private villas, and a family welcome.",
};

// Reads both session cookies (getGuestSessionAccount/getSessionUser both call next/headers'
// cookies()) so Nav can reflect an existing guest or staff session. That opts every page under
// this layout out of static generation - accepted deliberately, not overlooked: this backend is
// co-located on the hotel's own server, so the added round trip is cheap, and this is a
// low-traffic boutique site, not a page that needs to survive a traffic spike. /booking and
// /rooms already render dynamically for the same "needs a live backend read" reason.
export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const [guestAccount, staffUser] = await Promise.all([
    getGuestSessionAccount(),
    getSessionUser(),
  ]);

  return (
    <html lang="en" className={`${fraunces.variable} ${worksans.variable}`}>
      <body className="font-body bg-ink text-cream antialiased">
        <Nav guestAccount={guestAccount} staffUser={staffUser} />
        <main>{children}</main>
        <Footer />
      </body>
    </html>
  );
}
