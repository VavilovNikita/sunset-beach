"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { Role } from "@/lib/session";

// Always shown, regardless of role: GET /menu, /tables (via /admin/pos),
// GET /print-jobs are all "any authenticated staff" on the backend (see
// SecurityConfig) — a WAITER genuinely uses these to do their own job.
const BASE_LINKS = [
  { href: "/admin/pos", label: "POS" },
  { href: "/admin/pos/menu", label: "Menu" },
  { href: "/admin/pos/print-jobs", label: "Print queue" },
];

// GET /bookings, /bookings/calendar, /rooms, /pricing/*, /availability/* and
// GET /shifts/current are all CASHIER+ on the backend with no lower-privilege
// read — a WAITER hitting any of these would get a 403 (or, before the
// regression fix, a crashed page), so all five are shown conditionally
// rather than always shown and gated client-side. Dashboard belongs here too,
// not in BASE_LINKS: every figure on it (bookings/occupancy/revenue, POS
// revenue) comes from those same CASHIER+ reads, so a WAITER following this
// link got a page with a heading and nothing else - a menu item that always
// leads to an empty screen is worse than no menu item (see AdminDashboardPage
// - "forbidden" is a role-appropriate gap there, but nothing forces a WAITER
// to go looking for it).
const CASHIER_PLUS_LINKS = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/bookings", label: "Bookings" },
  { href: "/admin/bookings/calendar", label: "Calendar" },
  { href: "/admin/rooms", label: "Rooms" },
  { href: "/admin/pricing", label: "Pricing" },
  { href: "/admin/availability", label: "Availability" },
  { href: "/admin/pos/shifts", label: "Shifts" },
];

// GET /printers and GET /audit-log are both MANAGER+ on the backend with no
// lower-privilege read — unlike the rest of this list, a WAITER/CASHIER
// hitting either link would just get a 403 mid-page, so both are added
// conditionally rather than always shown and gated client-side.
const MANAGER_PLUS_LINKS = [
  { href: "/admin/pos/printers", label: "Printers" },
  { href: "/admin/history", label: "History" },
];

export default function AdminSidebar({ email, role }: { email: string; role: Role }) {
  const pathname = usePathname();
  const router = useRouter();

  async function handleSignOut() {
    await fetch("/api/session/logout", { method: "POST" });
    router.push("/admin/login");
    router.refresh();
  }

  // hasRoleAtLeast lives in lib/rbac.ts alongside next/headers-dependent
  // helpers, which can't be imported into a client component — the
  // hierarchy is inlined here instead (mirrors ROLE_RANK there).
  const isCashierPlus = role !== "WAITER";
  const isManagerPlus = role === "ADMIN" || role === "MANAGER";
  const items = [
    ...BASE_LINKS,
    ...(isCashierPlus ? CASHIER_PLUS_LINKS : []),
    ...(isManagerPlus ? MANAGER_PLUS_LINKS : []),
    ...(role === "ADMIN" ? [{ href: "/admin/users", label: "Users" }] : []),
  ];

  // Nested routes (e.g. /admin/bookings/calendar under /admin/bookings) mean more than one
  // item's href can prefix-match the current path — picking the single longest matching href
  // keeps exactly one item highlighted instead of a parent and its child both lighting up.
  const matching = items.filter((l) =>
    l.href === "/admin" ? pathname === "/admin" : pathname === l.href || pathname.startsWith(`${l.href}/`)
  );
  const activeHref = matching.sort((a, b) => b.href.length - a.href.length)[0]?.href;

  // The brand mark is a "go home" link everywhere else in this app - for a WAITER, home isn't
  // /admin (Dashboard is hidden from them for exactly this reason, see CASHIER_PLUS_LINKS), it's
  // the first item they actually have.
  const homeHref = isCashierPlus ? "/admin" : items[0]?.href ?? "/admin/pos";

  return (
    <aside className="w-full md:w-56 shrink-0 border-b md:border-b-0 md:border-r border-cream/10 md:min-h-screen bg-ink2/40">
      <div className="p-6">
        <Link href={homeHref} className="font-display italic text-lg text-cream block mb-8">
          The Sunset Beach
          <span className="block eyebrow text-sea font-sans not-italic mt-0.5">Admin</span>
        </Link>

        <nav className="flex flex-row md:flex-col gap-1 flex-wrap">
          {items.map((l) => {
            const active = l.href === activeHref;
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
          <Link href="/admin/account" className="text-xs text-cream/50 truncate block hover:text-cream transition-colors">
            {email}
          </Link>
          <p className="eyebrow text-cream/40 mt-0.5">{role}</p>
          <button
            onClick={handleSignOut}
            className="mt-4 text-sm text-cream/70 hover:text-coral transition-colors"
          >
            Sign out
          </button>
        </div>
      </div>
    </aside>
  );
}
