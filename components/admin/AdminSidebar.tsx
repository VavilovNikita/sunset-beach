"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import type { Role } from "@prisma/client";

const links = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/bookings", label: "Bookings" },
  { href: "/admin/rooms", label: "Rooms" },
  { href: "/admin/pricing", label: "Pricing" },
  { href: "/admin/availability", label: "Availability" },
];

export default function AdminSidebar({ email, role }: { email: string; role: Role }) {
  const pathname = usePathname();

  const items = role === "ADMIN" ? [...links, { href: "/admin/users", label: "Users" }] : links;

  return (
    <aside className="w-full md:w-56 shrink-0 border-b md:border-b-0 md:border-r border-cream/10 md:min-h-screen bg-ink2/40">
      <div className="p-6">
        <Link href="/admin" className="font-display italic text-lg text-cream block mb-8">
          The Sunset Beach
          <span className="block eyebrow text-sea font-sans not-italic mt-0.5">Admin</span>
        </Link>

        <nav className="flex flex-row md:flex-col gap-1 flex-wrap">
          {items.map((l) => {
            const active = l.href === "/admin" ? pathname === "/admin" : pathname.startsWith(l.href);
            return (
              <Link
                key={l.href}
                href={l.href}
                className={`text-sm px-3 py-2 rounded-lg transition-colors ${
                  active ? "bg-coral/15 text-coral" : "text-cream/70 hover:text-cream hover:bg-cream/5"
                }`}
              >
                {l.label}
              </Link>
            );
          })}
        </nav>

        <div className="mt-10 pt-6 border-t border-cream/10">
          <p className="text-xs text-cream/50 truncate">{email}</p>
          <p className="eyebrow text-cream/40 mt-0.5">{role}</p>
          <button
            onClick={() => signOut({ callbackUrl: "/admin/login" })}
            className="mt-4 text-sm text-cream/70 hover:text-coral transition-colors"
          >
            Sign out
          </button>
        </div>
      </div>
    </aside>
  );
}
