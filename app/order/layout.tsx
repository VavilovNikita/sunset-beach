import type { Metadata } from "next";
import { fraunces, worksans } from "@/lib/fonts";
import "../globals.css";

// This app has no app/layout.tsx — each top-level segment ((site), admin, pos) renders its own
// <html>/<body> instead of sharing one root layout (see those layouts' own files). This route
// tree needs its own for the same reason, but deliberately without Nav/Footer (the public site
// chrome) or any staff sidebar/auth guard: a guest scanning a table QR code is not on the public
// site and is not staff — see GuestOrderPage's own comment for why this route has no session
// check at all.
export const metadata: Metadata = {
  title: "Your order — The Sunset Beach Resort & Spa",
  robots: { index: false, follow: false },
};

export default function GuestOrderLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${fraunces.variable} ${worksans.variable}`}>
      <body className="font-body bg-ink text-cream antialiased">{children}</body>
    </html>
  );
}
