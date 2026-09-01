import type { Metadata } from "next";
import { fraunces, worksans } from "@/lib/fonts";
import "../globals.css";

export const metadata: Metadata = {
  title: "Admin — The Sunset Beach Resort & Spa",
  robots: { index: false, follow: false },
};

// Deliberately no PosIdleLogout-equivalent auto-logout timer here, unlike app/pos/layout.tsx.
// That timer exists as a safety net for a phone that gets left logged in and unattended on a
// table; this section runs on a workstation understood to be attended for a whole shift, so
// there's no comparable "left lying around" risk to guard against. Not an oversight - see
// PosIdleLogout.tsx's own comment for the other side of this note.
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
