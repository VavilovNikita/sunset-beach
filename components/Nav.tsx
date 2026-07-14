"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useState } from "react";

const links = [
  { href: "/", label: "Hotel" },
  { href: "/rooms", label: "Rooms & Villas" },
  { href: "/restaurant", label: "Restaurant" },
  { href: "/spa", label: "Spa" },
  { href: "/weddings", label: "Weddings & Events" },
  { href: "/contact", label: "Contact" },
];

export default function Nav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
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
          <Link
            href="/contact"
            className="ml-2 rounded-full bg-coral hover:bg-coraldeep transition-colors px-5 py-2 text-sm font-medium text-cream"
          >
            Book Now
          </Link>
        </nav>

        <button
          className="md:hidden text-cream"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-label="Toggle menu"
        >
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
            <path d="M3 6h18M3 12h18M3 18h18" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      {open && (
        <nav className="md:hidden border-t border-cream/10 bg-ink px-6 py-4 flex flex-col gap-4">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              onClick={() => setOpen(false)}
              className={`text-sm ${pathname === l.href ? "text-coral" : "text-cream/80"}`}
            >
              {l.label}
            </Link>
          ))}
        </nav>
      )}
    </header>
  );
}
