import type { Metadata } from "next";

// A client page cannot export metadata, so its title lives here: each guest page names itself instead of all
// showing the segment's "Your account".
export const metadata: Metadata = { title: "Guest sign-in — The Sunset Beach Resort & Spa" };

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
