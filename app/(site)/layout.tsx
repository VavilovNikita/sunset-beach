import type { Metadata } from "next";
import { fraunces, worksans } from "@/lib/fonts";
import "../globals.css";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";

export const metadata: Metadata = {
  title: "The Sunset Beach Resort & Spa — Taling Ngam, Koh Samui",
  description:
    "A secluded beachfront boutique resort on the quiet south-west coast of Koh Samui, far from Chaweng and Lamai — spectacular sunsets, private villas, and a family welcome.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${fraunces.variable} ${worksans.variable}`}>
      <body className="font-body bg-ink text-cream antialiased">
        <Nav />
        <main>{children}</main>
        <Footer />
      </body>
    </html>
  );
}
