import type { Metadata, Viewport } from "next";
import { fraunces, worksans } from "@/lib/fonts";
import { requireSessionUser } from "@/lib/rbac";
import PosTopBar from "@/components/pos/PosTopBar";
import PosIdleLogout from "@/components/pos/PosIdleLogout";
import "../globals.css";

// A separate root segment (sibling to app/admin and app/(site), same pattern both already use —
// its own <html>/<body>, nothing shared beyond next.config.js's CSP headers and middleware.ts,
// whose matcher now also covers /pos/:path*). This is a distinct interface for the floor, not a
// responsive view of the admin dashboard: no sidebar, no dense tables, built for a thumb on a
// phone screen rather than a mouse on a monitor.
export const metadata: Metadata = {
  title: "POS — The Sunset Beach Resort & Spa",
  description: "Floor ordering and payment for staff.",
  robots: { index: false, follow: false },
  manifest: "/pos-manifest.json",
  icons: {
    apple: "/pos-icons/apple-touch-icon.png",
    icon: "/pos-icons/favicon-32.png",
  },
};

// viewportFit: "cover" + the safe-area padding used throughout components/pos/* is what keeps
// controls clear of an iPhone's notch/home-indicator when this is added to the home screen and
// launched in standalone mode - untested territory for this codebase (no other section declares
// a viewport at all) since nothing else here is meant to be installed like an app.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  themeColor: "#0F262B",
};

export default async function PosRootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  // Floor access starts at WAITER, the floor of the role hierarchy - there's no role below it to
  // exclude, so "logged in" already is "WAITER or above". CASHIER-only sections (payment, shifts)
  // add their own requireRoleAtLeast("CASHIER", "/pos") on top of this, same pattern already used
  // by /admin/pos/shifts.
  const user = await requireSessionUser();

  return (
    <html lang="en" className={`${fraunces.variable} ${worksans.variable}`}>
      <body className="font-body bg-ink text-cream antialiased min-h-screen">
        <PosIdleLogout />
        <PosTopBar email={user.email} role={user.role} />
        <main className="pb-[max(1rem,env(safe-area-inset-bottom))]">{children}</main>
      </body>
    </html>
  );
}
