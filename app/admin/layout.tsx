import type { Metadata } from "next";
import { fraunces, worksans } from "@/lib/fonts";
import "../globals.css";

export const metadata: Metadata = {
  title: "Admin — The Sunset Beach Resort & Spa",
  robots: { index: false, follow: false },
};

export default function AdminRootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${fraunces.variable} ${worksans.variable}`}>
      <body className="font-body bg-ink text-cream antialiased min-h-screen">
        {children}
      </body>
    </html>
  );
}
