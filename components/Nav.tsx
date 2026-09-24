"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import type { GuestSessionAccount } from "@/lib/guestSession";
import type { SessionUser } from "@/lib/session";

const links = [
  { href: "/", label: "Hotel" },
  { href: "/rooms", label: "Rooms & Villas" },
  { href: "/restaurant", label: "Restaurant" },
  { href: "/spa", label: "Spa" },
  { href: "/weddings", label: "Weddings & Events" },
  { href: "/contact", label: "Contact" },
];

type NavProps = {
  guestAccount?: GuestSessionAccount | null;
  staffUser?: SessionUser | null;
};

export default function Nav({ guestAccount = null, staffUser = null }: NavProps) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  // Closes on any navigation (including browser back, which never fires a link's onClick) and on
  // Escape - the outside-tap backdrop below covers the touch case.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);
  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  // py-3 on a 20px text-sm line = 44px tall: a comfortable tap target, not just readable text.
  const mobileLinkClass = (href: string) => `block py-3 text-sm ${pathname === href ? "text-coral" : "text-cream/80"}`;

  return (
    <>
      <header className="sticky top-0 z-40 bg-ink/95 backdrop-blur border-b border-cream/10">
        <div className="mx-auto max-w-6xl px-6 flex items-center justify-between h-20">
          <Link href="/" className="flex items-center shrink-0">
            <Image
              src="/images/logo.png"
              alt="The Sunset Beach Resort & Spa · Taling Ngam"
              width={800}
              height={546}
              priority
              className="h-12 w-auto brightness-0 invert"
            />
          </Link>

          <nav className="hidden md:flex items-center gap-7">
            {links.map((l) => {
              const active = pathname === l.href;
              return (
                <Link
                  key={l.href}
                  href={l.href}
                  className={`text-sm tracking-wide transition-colors ${
                    active ? "text-coral" : "text-cream/80 hover:text-coral"
                  }`}
                >
                  {l.label}
                </Link>
              );
            })}
            {staffUser ? (
              <Link href="/admin" className="text-sm tracking-wide text-cream/80 hover:text-coral transition-colors">
                Dashboard
              </Link>
            ) : guestAccount ? (
              <Link href="/guest/account" className="text-sm tracking-wide text-cream/80 hover:text-coral transition-colors">
                My account
              </Link>
            ) : (
              <>
                <Link href="/login" className="text-sm tracking-wide text-cream/80 hover:text-coral transition-colors">
                  Sign in
                </Link>
                <Link href="/guest/register" className="text-sm tracking-wide text-cream/80 hover:text-coral transition-colors">
                  Create account
                </Link>
              </>
            )}
            <Link
              href="/booking"
              className="ml-2 rounded-full bg-coral hover:bg-coraldeep transition-colors px-5 py-2 text-sm font-medium text-cream"
            >
              Book Now
            </Link>
          </nav>

          {/* 44x44 tap area around a 26px icon; -mr-2.5 keeps the icon itself where it was. */}
          <button
            type="button"
            className="md:hidden -mr-2.5 w-11 h-11 flex items-center justify-center text-cream"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-controls="mobile-nav"
            aria-label={open ? "Close menu" : "Open menu"}
          >
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              {open ? (
                <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
              ) : (
                <path d="M3 6h18M3 12h18M3 18h18" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
              )}
            </svg>
          </button>
        </div>

        {/* Overlays the page (absolute under the sticky header) instead of pushing it down, and
            scrolls itself if a short screen can't fit it. */}
        {open && (
          <nav
            id="mobile-nav"
            className="md:hidden absolute left-0 right-0 top-full border-t border-b border-cream/10 bg-ink px-6 py-2 flex flex-col max-h-[calc(100dvh-5rem)] overflow-y-auto shadow-2xl shadow-black/40"
          >
            {links.map((l) => (
              <Link key={l.href} href={l.href} onClick={() => setOpen(false)} className={mobileLinkClass(l.href)}>
                {l.label}
              </Link>
            ))}
            {staffUser ? (
              <Link href="/admin" onClick={() => setOpen(false)} className={mobileLinkClass("/admin")}>
                Dashboard
              </Link>
            ) : guestAccount ? (
              <Link href="/guest/account" onClick={() => setOpen(false)} className={mobileLinkClass("/guest/account")}>
                My account
              </Link>
            ) : (
              <>
                <Link href="/login" onClick={() => setOpen(false)} className={mobileLinkClass("/login")}>
                  Sign in
                </Link>
                <Link href="/guest/register" onClick={() => setOpen(false)} className={mobileLinkClass("/guest/register")}>
                  Create account
                </Link>
              </>
            )}
            {/* Same destination as the desktop nav's Book Now - on pages with no date form of their
                own (/koh-samui, /privacy, /terms) this was otherwise missing on mobile entirely. */}
            <Link
              href="/booking"
              onClick={() => setOpen(false)}
              className="mt-2 mb-3 rounded-full bg-coral hover:bg-coraldeep transition-colors py-3 text-center text-sm font-medium text-cream"
            >
              Book Now
            </Link>
          </nav>
        )}
      </header>

      {/* Outside-tap-to-close. Rendered outside <header> on purpose: the header's backdrop-blur
          makes it the containing block for any position:fixed descendant, which would shrink this
          to the header's own box. z-30 sits under the header (z-40) and over the page. */}
      {open && <div className="md:hidden fixed inset-0 z-30 bg-ink/60" onClick={() => setOpen(false)} aria-hidden="true" />}
    </>
  );
}
