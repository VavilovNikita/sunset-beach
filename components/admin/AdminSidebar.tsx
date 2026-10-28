"use client";

import Link from "next/link";
import { useEffect, useLayoutEffect, useReducer, useRef, useState, useSyncExternalStore } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { JobFunction, Role } from "@/lib/session";
import {
  activeNavGroupTitle,
  activeNavHref,
  groupLinks,
  loadStoredOpenNavGroups,
  navPathname,
  navSections,
  saveStoredOpenNavGroups,
  visibleNavGroups,
  type NavGroup,
} from "@/lib/adminNav";
import { FLYOUT_CLOSED, FLYOUT_CLOSE_DELAY_MS, flyoutReducer } from "@/lib/navFlyout";
import { STAFF_MANUAL_HREF } from "@/lib/staticPages";

// Hover menus only where there is a mouse and room for them. Everything else (touch, phone width) keeps
// the accordion. Server render and first client render are the accordion; the desktop switches on mount.
const FLYOUT_QUERY = "(min-width: 768px) and (hover: hover) and (pointer: fine)";

function subscribeFlyoutMode(onChange: () => void) {
  const query = window.matchMedia(FLYOUT_QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

function useFlyoutMode(): boolean {
  return useSyncExternalStore(subscribeFlyoutMode, () => window.matchMedia(FLYOUT_QUERY).matches, () => false);
}

function groupDomId(title: string, kind: "list" | "panel") {
  return `admin-nav-${kind}-${title.toLowerCase().replace(/\W+/g, "-")}`;
}

function NavSections({
  group,
  activeHref,
  linkClass,
  onLinkClick,
  sectionClass,
}: {
  group: NavGroup;
  activeHref: string | undefined;
  linkClass: string;
  onLinkClick?: () => void;
  sectionClass: string;
}) {
  const { sections, divider } = navSections(group);
  return (
    <>
      {sections.map((links, i) => (
        <div key={i}>
          {divider && i === 1 && (
            <div className="mt-2 mb-1 border-t border-cream/10 pt-2 px-3 eyebrow text-cream/40">Settings</div>
          )}
          <div className={sectionClass}>
            {links.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                onClick={onLinkClick}
                className={`${linkClass} ${
                  l.href === activeHref ? "bg-coral/15 text-coral" : "text-cream/70 hover:text-cream hover:bg-cream/5"
                }`}
              >
                {l.label}
              </Link>
            ))}
          </div>
        </div>
      ))}
    </>
  );
}

export default function AdminSidebar({ email, role, functions }: { email: string; role: Role; functions: JobFunction[] }) {
  // A spa ticket lives under /admin/pos/orders but belongs to Spa - see lib/adminNav.ts#navPathname.
  const pathname = navPathname(usePathname(), useSearchParams().get("section"));
  const router = useRouter();

  async function handleSignOut() {
    await fetch("/api/session/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  // Already filtered to this role, with any group left empty dropped entirely (see
  // lib/adminNav.ts's own tests for "every role, no empty group header" as an automated check,
  // not just something eyeballed across four logins). allLinks (group boundaries dropped) is
  // only for the two things below that need one flat list: which link is "active", and where the
  // brand mark links a WAITER (who has no /admin landing of their own - see homeHref).
  const groups = visibleNavGroups(role, functions);
  const allLinks = groups.flatMap(groupLinks);
  const activeHref = activeNavHref(allLinks, pathname);
  const activeGroup = activeNavGroupTitle(groups, pathname);
  const activeLabel = allLinks.find((l) => l.href === activeHref)?.label ?? null;

  const flyoutMode = useFlyoutMode();

  // ---- Accordion (touch and phone width) ----
  // First paint (server and client alike - SSR has no localStorage) opens only the group holding the
  // current page; whatever the viewer opened before is merged in on mount. Navigating into a
  // collapsed group opens it, so the highlighted link is never hidden. The desktop flyout has no
  // such state and never reads or writes the stored list.
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

  // Phone width: the whole sidebar used to stack above the page (brand, group headers, the
  // open group's links, the account block) - more than half the screen before any content. Below
  // md it's one bar with the current page and a Menu button; navigating closes it again.
  const [mobileOpen, setMobileOpen] = useState(false);
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  // ---- Flyout (desktop with a mouse) ----
  // Which panel is showing and the close timer live in lib/navFlyout.ts (tested); this only wires
  // the DOM events to it and runs the timer.
  const [flyout, dispatch] = useReducer(flyoutReducer, FLYOUT_CLOSED);
  const navRef = useRef<HTMLElement>(null);
  const headingRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const panelRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const focusFirstOnOpen = useRef<string | null>(null);

  useEffect(() => {
    if (!flyout.closePending) return;
    const timer = setTimeout(() => dispatch({ type: "closeTimer" }), FLYOUT_CLOSE_DELAY_MS);
    return () => clearTimeout(timer);
  }, [flyout.closePending, flyout.open]);

  // Navigating, or the screen turning into a touch / narrow one, closes whatever is open.
  useEffect(() => {
    dispatch({ type: "close" });
  }, [pathname, flyoutMode]);

  useEffect(() => {
    if (flyout.open === null) return;
    function onPointerDown(e: PointerEvent) {
      if (navRef.current && !navRef.current.contains(e.target as Node)) dispatch({ type: "close" });
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") dispatch({ type: "close" });
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [flyout.open]);

  // The panel opens beside its heading; a heading near the bottom would push it off the window, so
  // it is shifted up to fit (its own max-height and scrolling cover a window shorter than the panel).
  useLayoutEffect(() => {
    const title = flyout.open;
    if (title === null) return;
    const panel = panelRefs.current[title];
    if (!panel) return;
    panel.style.top = "0px";
    const rect = panel.getBoundingClientRect();
    const margin = 8;
    let shift = Math.min(0, window.innerHeight - margin - rect.bottom);
    shift = Math.max(shift, margin - rect.top);
    panel.style.top = `${shift}px`;
    if (focusFirstOnOpen.current === title) {
      focusFirstOnOpen.current = null;
      panel.querySelector<HTMLElement>("a[href]")?.focus();
    }
  }, [flyout.open]);

  function panelLinks(title: string): HTMLElement[] {
    return Array.from(panelRefs.current[title]?.querySelectorAll<HTMLElement>("a[href]") ?? []);
  }

  function openFromKeyboard(title: string) {
    if (flyout.open === title) panelLinks(title)[0]?.focus();
    else focusFirstOnOpen.current = title;
    dispatch({ type: "open", group: title });
  }

  function onGroupKeyDown(e: React.KeyboardEvent<HTMLDivElement>, title: string) {
    if (e.key === "Escape" && flyout.open === title) {
      e.preventDefault();
      dispatch({ type: "close" });
      headingRefs.current[title]?.focus();
      return;
    }
    if (e.target === headingRefs.current[title] && e.key === "ArrowDown") {
      e.preventDefault();
      openFromKeyboard(title);
      return;
    }
    const links = panelLinks(title);
    const index = links.indexOf(e.target as HTMLElement);
    if (index === -1) return;
    if (e.key === "ArrowDown") links[(index + 1) % links.length].focus();
    else if (e.key === "ArrowUp") links[(index - 1 + links.length) % links.length].focus();
    else if (e.key === "Home") links[0].focus();
    else if (e.key === "End") links[links.length - 1].focus();
    else return;
    e.preventDefault();
  }

  function onGroupBlur(e: React.FocusEvent<HTMLDivElement>, title: string) {
    // Tab (or Shift+Tab) out of the heading + panel closes it; focus leaving the window does not.
    const next = e.relatedTarget as Node | null;
    if (flyout.open === title && next && !e.currentTarget.contains(next)) dispatch({ type: "close" });
  }

  function keyboardFocusInside(wrapper: HTMLElement): boolean {
    const active = document.activeElement;
    return !!active && wrapper.contains(active) && active.matches(":focus-visible");
  }

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
            className="md:hidden flex items-center gap-2 min-w-0 min-h-11 rounded-full border border-cream/20 px-4 py-2 text-sm text-cream/80"
          >
            {activeLabel && !mobileOpen && <span className="truncate text-cream/60">{activeLabel}</span>}
            <span className="shrink-0">{mobileOpen ? "Close ✕" : "Menu ☰"}</span>
          </button>
        </div>

        <div id="admin-nav-menu" className={`${mobileOpen ? "block" : "hidden"} md:block mt-4 md:mt-0`}>
          {flyoutMode ? (
            <nav ref={navRef} aria-label="Admin" className="flex flex-col gap-1">
              {groups.map((group) => {
                const title = group.title;
                const open = flyout.open === title;
                const isActive = title === activeGroup;
                const panelId = groupDomId(title, "panel");
                return (
                  <div
                    key={title}
                    className="relative"
                    onPointerEnter={(e) => e.pointerType !== "touch" && dispatch({ type: "hoverIn", group: title })}
                    onPointerLeave={(e) =>
                      e.pointerType !== "touch" &&
                      dispatch({ type: "hoverOut", keepOpen: keyboardFocusInside(e.currentTarget) })
                    }
                    onKeyDown={(e) => onGroupKeyDown(e, title)}
                    onBlur={(e) => onGroupBlur(e, title)}
                  >
                    <button
                      type="button"
                      ref={(el) => {
                        headingRefs.current[title] = el;
                      }}
                      // detail 0 = the click came from Enter or Space, not the mouse.
                      onClick={(e) => (e.detail === 0 ? openFromKeyboard(title) : dispatch({ type: "click", group: title }))}
                      aria-expanded={open}
                      aria-controls={panelId}
                      aria-haspopup="true"
                      className={`w-full flex items-center justify-between gap-2 text-left px-3 py-2 rounded-lg transition-colors ${
                        open ? "bg-cream/10 text-cream" : isActive ? "bg-cream/5 text-cream" : "text-cream/60 hover:text-cream"
                      }`}
                    >
                      <span className="min-w-0">
                        <span className="block text-sm font-medium">{title}</span>
                        {isActive && activeLabel && <span className="block truncate text-xs text-coral/90">{activeLabel}</span>}
                      </span>
                      <span aria-hidden className="shrink-0 text-cream/40">›</span>
                    </button>
                    {/* pl-6 is the sidebar's own padding: the panel's hover area reaches the sidebar edge, so
                        the cursor never crosses a gap that is outside both the heading and the panel. */}
                    <div
                      id={panelId}
                      ref={(el) => {
                        panelRefs.current[title] = el;
                      }}
                      className={`${open ? "block" : "hidden"} absolute left-full top-0 z-50 pl-6`}
                    >
                      <div className="w-60 max-h-[calc(100vh-1rem)] overflow-y-auto rounded-xl border border-cream/15 bg-ink shadow-2xl shadow-black/40 p-2">
                        <NavSections
                          group={group}
                          activeHref={activeHref}
                          linkClass="block text-sm px-3 py-2 rounded-lg transition-colors"
                          sectionClass="flex flex-col gap-0.5"
                          onLinkClick={() => dispatch({ type: "close" })}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </nav>
          ) : (
            <nav className="flex flex-col gap-3">
              {groups.map((group) => {
                const open = openGroups.includes(group.title);
                const listId = groupDomId(group.title, "list");
                return (
                  <div key={group.title}>
                    <button
                      type="button"
                      onClick={() => toggleGroup(group.title)}
                      aria-expanded={open}
                      aria-controls={listId}
                      className={`w-full min-h-11 flex items-center justify-between eyebrow mb-1 px-3 py-1 rounded-lg transition-colors hover:text-cream ${
                        group.title === activeGroup ? "text-cream/70" : "text-cream/40"
                      }`}
                    >
                      <span>{group.title}</span>
                      <span aria-hidden className={`transition-transform ${open ? "rotate-90" : ""}`}>›</span>
                    </button>
                    <div id={listId} className={open ? "block" : "hidden"}>
                      <NavSections
                        group={group}
                        activeHref={activeHref}
                        linkClass="flex items-center min-h-11 text-sm px-3 py-2 rounded-lg transition-colors"
                        sectionClass="flex flex-row md:flex-col gap-1 flex-wrap"
                      />
                    </div>
                  </div>
                );
              })}
            </nav>
          )}

          <div className="mt-10 pt-6 border-t border-cream/10">
            <Link href="/admin/account" className="text-xs text-cream/50 truncate block hover:text-cream transition-colors">
              {email}
            </Link>
            <p className="eyebrow text-cream/40 mt-0.5">{role}</p>
            {/* Served by nginx, not this app (lib/staticPages.ts) - a plain link, opened in its own tab. */}
            <a
              href={STAFF_MANUAL_HREF}
              target="_blank"
              rel="noopener"
              className="mt-4 flex w-fit items-center min-h-11 md:min-h-0 text-sm text-cream/70 hover:text-cream transition-colors"
            >
              Staff manual ↗
            </a>
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
