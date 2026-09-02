"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { Role } from "@/lib/session";
import { visibleNavGroups } from "@/lib/adminNav";

export default function AdminSidebar({ email, role }: { email: string; role: Role }) {
  const pathname = usePathname();
  const router = useRouter();

  async function handleSignOut() {
    await fetch("/api/session/logout", { method: "POST" });
    router.push("/admin/login");
    router.refresh();
  }

  // Already filtered to this role, with any group left empty dropped entirely (see
  // lib/adminNav.ts's own tests for "every role, no empty group header" as an automated check,
  // not just something eyeballed across four logins). allLinks (group boundaries dropped) is
  // only for the two things below that need one flat list: which link is "active", and where the
  // brand mark links a WAITER (who has no /admin landing of their own - see homeHref).
  const groups = visibleNavGroups(role);
  const allLinks = groups.flatMap((g) => g.links);

  // Nested routes (e.g. /admin/bookings/calendar under /admin/bookings) mean more than one
  // item's href can prefix-match the current path — picking the single longest matching href
  // keeps exactly one item highlighted instead of a parent and its child both lighting up.
  const matching = allLinks.filter((l) =>
    l.href === "/admin" ? pathname === "/admin" : pathname === l.href || pathname.startsWith(`${l.href}/`)
  );
  const activeHref = matching.sort((a, b) => b.href.length - a.href.length)[0]?.href;

  const isCashierPlus = role !== "WAITER";
  // The brand mark is a "go home" link everywhere else in this app - for a WAITER, home isn't
  // /admin (Dashboard is CASHIER+ for exactly this reason), it's the first item they actually have.
  const homeHref = isCashierPlus ? "/admin" : (allLinks[0]?.href ?? "/admin/pos");

  return (
    <aside className="w-full md:w-56 shrink-0 border-b md:border-b-0 md:border-r border-cream/10 md:min-h-screen bg-ink2/40">
      <div className="p-6">
        <Link href={homeHref} className="font-display italic text-lg text-cream block mb-8">
          The Sunset Beach
          <span className="block eyebrow text-sea font-sans not-italic mt-0.5">Admin</span>
        </Link>

        <nav className="flex flex-col gap-5">
          {groups.map((group) => (
            <div key={group.title}>
              <p className="eyebrow text-cream/40 mb-1 px-3">{group.title}</p>
              <div className="flex flex-row md:flex-col gap-1 flex-wrap">
                {group.links.map((l) => {
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
              </div>
            </div>
          ))}
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
