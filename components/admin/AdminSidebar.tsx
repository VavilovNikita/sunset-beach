"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import type { Role } from "@/lib/session";
import {
  activeNavGroupTitle,
  activeNavHref,
  loadStoredOpenNavGroups,
  saveStoredOpenNavGroups,
  visibleNavGroups,
} from "@/lib/adminNav";

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
  const activeHref = activeNavHref(allLinks, pathname);
  const activeGroup = activeNavGroupTitle(groups, pathname);

  // Collapsible groups: first paint (server and client alike - SSR has no localStorage) opens only
  // the group holding the current page; whatever the viewer opened before is merged in on mount.
  // Navigating into a collapsed group opens it, so the highlighted link is never hidden.
  const [openGroups, setOpenGroups] = useState<string[]>(activeGroup ? [activeGroup] : []);
  useEffect(() => {
    const stored = loadStoredOpenNavGroups();
    if (stored) setOpenGroups((prev) => Array.from(new Set([...stored, ...prev])));
  }, []);
  useEffect(() => {
    if (activeGroup) setOpenGroups((prev) => (prev.includes(activeGroup) ? prev : [...prev, activeGroup]));
  }, [activeGroup]);
  function toggleGroup(title: string) {
    setOpenGroups((prev) => {
      const next = prev.includes(title) ? prev.filter((t) => t !== title) : [...prev, title];
      saveStoredOpenNavGroups(next);
      return next;
    });
  }

  // Phone width: the whole sidebar used to stack above the page (brand, five group headers, the
  // open group's links, the account block) - more than half the screen before any content. Below
  // md it's one bar with the current page and a Menu button; navigating closes it again.
  const [mobileOpen, setMobileOpen] = useState(false);
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);
  const activeLabel = allLinks.find((l) => l.href === activeHref)?.label ?? null;

  const isCashierPlus = role !== "WAITER";
  // The brand mark is a "go home" link everywhere else in this app - for a WAITER, home isn't
  // /admin (Dashboard is CASHIER+ for exactly this reason), it's the first item they actually have.
  const homeHref = isCashierPlus ? "/admin" : (allLinks[0]?.href ?? "/admin/pos");

  return (
    <aside className="print:hidden w-full md:w-56 shrink-0 border-b md:border-b-0 md:border-r border-cream/10 md:min-h-screen bg-ink2/40">
      <div className="px-4 py-3 md:p-6">
        <div className="flex items-center justify-between gap-3 md:block md:mb-8">
          <Link href={homeHref} className="font-display italic text-lg text-cream block">
            The Sunset Beach
            <span className="hidden md:block eyebrow text-sea font-sans not-italic mt-0.5">Admin</span>
          </Link>
          <button
            type="button"
            onClick={() => setMobileOpen((v) => !v)}
            aria-expanded={mobileOpen}
            aria-controls="admin-nav-menu"
            className="md:hidden flex items-center gap-2 min-w-0 rounded-full border border-cream/20 px-4 py-2 text-sm text-cream/80"
          >
            {activeLabel && !mobileOpen && <span className="truncate text-cream/60">{activeLabel}</span>}
            <span className="shrink-0">{mobileOpen ? "Close ✕" : "Menu ☰"}</span>
          </button>
        </div>

        <div id="admin-nav-menu" className={`${mobileOpen ? "block" : "hidden"} md:block mt-4 md:mt-0`}>
        <nav className="flex flex-col gap-3">
          {groups.map((group) => {
            const open = openGroups.includes(group.title);
            const listId = `admin-nav-${group.title.toLowerCase().replace(/\W+/g, "-")}`;
            return (
              <div key={group.title}>
                <button
                  type="button"
                  onClick={() => toggleGroup(group.title)}
                  aria-expanded={open}
                  aria-controls={listId}
                  className={`w-full flex items-center justify-between eyebrow mb-1 px-3 py-1 rounded-lg transition-colors hover:text-cream ${
                    group.title === activeGroup ? "text-cream/70" : "text-cream/40"
                  }`}
                >
                  <span>{group.title}</span>
                  <span aria-hidden className={`transition-transform ${open ? "rotate-90" : ""}`}>›</span>
                </button>
                <div id={listId} className={`${open ? "flex" : "hidden"} flex-row md:flex-col gap-1 flex-wrap`}>
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
      </div>
    </aside>
  );
}
