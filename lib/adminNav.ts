// The admin sidebar's link structure, as data + a pure filter - kept out of AdminSidebar.tsx so
// "does each role see the right groups, and never an empty group header" is a testable rule
// (adminNav.test.ts), not something only checked by eye in four separate browser logins.
import type { JobFunction, Role } from "@/lib/session";

export type NavLink = {
  href: string;
  label: string;
  // Undefined = any authenticated staff role, including WAITER (matches a backend endpoint with
  // no lower-privilege read). Otherwise the minimum role the backend actually requires.
  minRole?: Exclude<Role, "WAITER">;
  // A job function that unlocks the link whatever the role - OR'd with minRole, never ANDed (a
  // function opens a link a role floor alone would hide). Mirrors a backend gate of the form
  // "CASHIER+ or FUNCTION_<name>"; today only THERAPIST reading the spa schedule.
  orFunction?: JobFunction;
};

export type NavGroup = {
  title: string;
  // Everyday work, shown first.
  links: NavLink[];
  // The configuration of this area (devices, layouts, users), shown under a divider. Still part
  // of the group, not a catch-all "Setup" group - see the comment on NAV_GROUPS.
  setup: NavLink[];
};

// Grouped by what someone is actually doing, not by when the feature was built - within a section,
// most-frequent-first. Today and POS lead their groups on purpose: they're the two roles' actual
// entry points (see ROLE_LANDING in app/admin/login/page.tsx), so the sidebar should already be
// pointing at them. One group per area of the hotel, plus Reports. Each group has everyday links
// and, under a divider, `setup` links - the configuration of that same area. There used to be a
// catch-all "Setup" group, which put links next to things they had nothing to do with (the POS
// printers beside room types), so configuration stays beside the people who use what it configures.
export const NAV_GROUPS: NavGroup[] = [
  {
    title: "Front desk",
    // GET /bookings, /bookings/calendar, /property-map are CASHIER+ on the backend with no
    // lower-privilege read - a WAITER hitting any of these would get a 403 (or, before an earlier
    // regression fix, a crashed page), so these links are CASHIER+ rather than shown and gated
    // client-side.
    links: [
      { href: "/admin/today", label: "Today", minRole: "CASHIER" },
      { href: "/admin/bookings/calendar", label: "Calendar", minRole: "CASHIER" },
      { href: "/admin/bookings", label: "Bookings", minRole: "CASHIER" },
      { href: "/admin/guests", label: "Guests", minRole: "CASHIER" },
      { href: "/admin/property-map", label: "Property map", minRole: "CASHIER" },
      // GET /reports/in-house is the one CASHIER+ report - the daily list of who is in which room.
      { href: "/admin/in-house", label: "In house", minRole: "CASHIER" },
      // GET /night-audit and POST /night-audit/close are CASHIER+ - the daily close is routine
      // front-desk work, not a MANAGER+ report.
      { href: "/admin/night-audit", label: "Night audit", minRole: "CASHIER" },
    ],
    setup: [
      // Automated pre-arrival/post-stay/win-back emails to guests with a verified account - about
      // the guest's stay, nothing to do with the restaurant. ADMIN-only: GET/PUT
      // /settings/lifecycle-emails has no lower-privilege read, since it decides what automated
      // email reaches every eligible guest.
      { href: "/admin/settings/lifecycle-emails", label: "Guest emails", minRole: "ADMIN" },
    ],
  },
  {
    title: "Rooms",
    links: [
      // GET /room-units (housekeeping) is CASHIER+ with no lower-privilege read.
      { href: "/admin/housekeeping", label: "Housekeeping", minRole: "CASHIER" },
      // Room tasks (a broken air conditioner, a leak) - about the rooms, so it sits beside
      // Housekeeping rather than under Staff. Any authenticated staff role, including WAITER:
      // GET/POST /maintenance-tasks have no role floor on the backend, and the whole point is
      // that whoever notices a problem can report it, not just an ENGINEER or a manager. A hidden
      // link would mean a waiter who spots a broken air conditioner - the actual common case - has
      // no way to reach the one screen that lets them say so. (Blocking a room and moving a task
      // through its statuses stay MANAGER+ / the ENGINEER function respectively - gated inside the
      // page itself, per action, not by hiding the page.) The only Rooms link a WAITER sees.
      { href: "/admin/maintenance", label: "Maintenance" },
      // Prices and RoomUnitBlocks (the merged Pricing + Availability month table; /admin/pricing
      // and /admin/availability redirect to it). It's the front desk that sells these rooms, on
      // the same CASHIER+ floor - their per-booking view is Calendar.
      { href: "/admin/rates", label: "Rates & availability", minRole: "CASHIER" },
    ],
    setup: [
      // The room types themselves, on the same CASHIER+ floor as the rest.
      { href: "/admin/rooms", label: "Rooms", minRole: "CASHIER" },
    ],
  },
  {
    title: "Restaurant",
    // POS, the print queue, and the menu are open to any staff role, including WAITER - a waiter
    // genuinely uses all three to do their own job (take orders, check a failed kitchen ticket,
    // look up a menu item), even though only a MANAGER can edit the menu itself. Shifts is
    // CASHIER+ (cash-drawer open/close), matching GET /shifts/current. Printers is MANAGER+
    // (registering/editing physical hardware) - the kitchen/bar/receipt printers the POS prints
    // to, so it lives in the same group as the Print queue.
    links: [
      { href: "/admin/pos", label: "POS" },
      { href: "/admin/pos/print-jobs", label: "Print queue" },
      { href: "/admin/pos/shifts", label: "Shifts", minRole: "CASHIER" },
      { href: "/admin/pos/menu", label: "Menu" },
    ],
    setup: [
      { href: "/admin/pos/printers", label: "Printers", minRole: "MANAGER" },
      // How the receipt, pre-bill, kitchen/bar tickets and Z-report look. ADMIN-only:
      // GET/PUT /settings/print-layouts has no lower-privilege read, like every /settings route.
      { href: "/admin/settings/print-layouts", label: "Print layouts", minRole: "ADMIN" },
    ],
  },
  {
    title: "Spa",
    // The live table map and the treatment list are CASHIER+. GET /spa-appointments is CASHIER+ or
    // the THERAPIST function (read only: the page opens in a read-only mode for a therapist below
    // CASHIER), so Appointments is the one Spa link a therapist sees. Tables (the raw CRUD list, no
    // live-occupancy value) is MANAGER+, matching its page's own gate.
    links: [
      { href: "/admin/spa", label: "Appointments", minRole: "CASHIER", orFunction: "THERAPIST" },
      { href: "/admin/spa/map", label: "Table map", minRole: "CASHIER" },
      { href: "/admin/spa/treatments", label: "Treatments", minRole: "CASHIER" },
    ],
    setup: [{ href: "/admin/spa/tables", label: "Tables", minRole: "MANAGER" }],
  },
  {
    title: "Gym & lighting",
    links: [
      // The reservation schedule (GET/POST /gym/reservations*) is CASHIER+ like the equipment page; the hall
      // hours and the automation's parameters sit on the ADMIN-only "Gym devices" page.
      { href: "/admin/gym/schedule", label: "Gym schedule", minRole: "CASHIER" },
      // Fans and air conditioners over the Tuya cloud. GET/POST /gym/devices* is CASHIER+ (switching them is
      // front-desk work); the device list under /gym/settings is ADMIN-only like every settings route, and
      // longest-href matching keeps just one of the two highlighted.
      { href: "/admin/gym", label: "Gym", minRole: "CASHIER" },
      // WLED lighting controllers on the hotel LAN. Reading the state and sending a command (GET /lighting/devices,
      // POST /lighting/devices/{id}/state) is MANAGER+ on the backend (SecurityConfig.LIGHTING_CONTROL_ROLE - if the
      // owner picks another role, change it there and here together); the controller list and the address test
      // under /lighting/settings are ADMIN-only. Longest-href matching keeps just one of the two highlighted.
      { href: "/admin/lighting", label: "Lighting", minRole: "MANAGER" },
    ],
    setup: [
      { href: "/admin/gym/settings", label: "Gym devices", minRole: "ADMIN" },
      { href: "/admin/lighting/settings", label: "Lighting devices", minRole: "ADMIN" },
    ],
  },
  {
    title: "Staff",
    // GET /roster, /attendance, /employee-pay-rates and friends are all MANAGER+ on the backend
    // (see openapi.yaml's Roster tag) - same floor as pay itself, since attendance is the data
    // pay depends on. "My schedule" is the one exception: GET /roster/me has no role floor at
    // all, matching the module's own "own schedule visible to each employee" decision - it needs
    // no minRole here for exactly that reason. GET /attendance/devices is MANAGER+, same floor as
    // the rest of this group - registering/editing physical hardware, same reasoning as Printers
    // under Restaurant. GET /users and POST /roster/import/* are both ADMIN-only, hard-restricted
    // regardless of the role hierarchy - the importer can create User accounts on the spot, the
    // same reason it needs the same floor as Users itself.
    links: [
      { href: "/admin/schedule", label: "My schedule" },
      { href: "/admin/roster", label: "Roster", minRole: "MANAGER" },
      // Messages to staff over Telegram. The log and the channel list (linking a chat needs no login, so managers
      // do it; GET /notifications/** is MANAGER+) sit with the people who read them; the settings are ADMIN-only
      // like every /settings route. Longest-href matching keeps just one of the three highlighted.
      { href: "/admin/notifications", label: "Notifications", minRole: "MANAGER" },
      { href: "/admin/notifications/staff", label: "Notification channels", minRole: "MANAGER" },
    ],
    setup: [
      { href: "/admin/attendance-devices", label: "Fingerprint terminals", minRole: "MANAGER" },
      { href: "/admin/roster/import", label: "Import schedule", minRole: "ADMIN" },
      { href: "/admin/users", label: "Users", minRole: "ADMIN" },
      { href: "/admin/settings/notifications", label: "Notification settings", minRole: "ADMIN" },
    ],
  },
  {
    title: "Reports",
    // Dashboard belongs here, not Front desk: every figure on it (bookings/occupancy/revenue,
    // POS revenue) comes from the same CASHIER+ reads as the rest of this group, and it answers
    // "how are we doing", not "what do I do right now" - that's Today's job. History (the audit
    // log) is MANAGER+ - GET /audit-log has no lower-privilege read. Reports is one page with a tab
    // per report (manager report, occupancy, top production, market segment, sales mix, guest LTV),
    // MANAGER+ because every GET /reports/* except in-house shares the revenue export's floor - so it
    // lives here, not beside the CASHIER+ Night audit / In house under Front desk.
    links: [
      { href: "/admin", label: "Dashboard", minRole: "CASHIER" },
      { href: "/admin/reports", label: "Reports", minRole: "MANAGER" },
      { href: "/admin/history", label: "History", minRole: "MANAGER" },
    ],
    setup: [],
  },
];

function meetsMinRole(minRole: Exclude<Role, "WAITER">, role: Role): boolean {
  if (minRole === "CASHIER") return role !== "WAITER";
  if (minRole === "MANAGER") return role === "MANAGER" || role === "ADMIN";
  return role === "ADMIN";
}

export function isNavLinkVisible(link: NavLink, role: Role, functions: readonly JobFunction[] = []): boolean {
  if (!link.minRole || meetsMinRole(link.minRole, role)) return true;
  return link.orFunction !== undefined && functions.includes(link.orFunction);
}

// Both sections of a group filtered to what this role may see, with any group left with no link
// at all dropped entirely - a group header must never render with nothing under it.
export function visibleNavGroups(role: Role, functions: readonly JobFunction[] = []): NavGroup[] {
  return NAV_GROUPS.map((g) => ({
    ...g,
    links: g.links.filter((l) => isNavLinkVisible(l, role, functions)),
    setup: g.setup.filter((l) => isNavLinkVisible(l, role, functions)),
  })).filter((g) => g.links.length + g.setup.length > 0);
}

// Every link of a group in display order, everyday section first.
export function groupLinks(group: NavGroup): NavLink[] {
  return [...group.links, ...group.setup];
}

// What a group draws: its sections, and whether a divider (with the "Settings" caption) goes between
// them. A divider separates two things, so it is drawn only when both sections have links - a group
// left with only its setup links (or only everyday ones) shows one plain list.
export function navSections(group: NavGroup): { sections: NavLink[][]; divider: boolean } {
  const sections = [group.links, group.setup].filter((s) => s.length > 0);
  return { sections, divider: sections.length === 2 };
}

// A page that belongs to one section but lives under another's URL (a spa treatment is billed on the
// POS order ticket, /admin/pos/orders/...) says so with ?section=spa, because the sidebar can only
// read the URL. The result is what the sidebar matches its links against.
export const SPA_SECTION = "spa";

export function navPathname(pathname: string, section: string | null | undefined): string {
  if (section === SPA_SECTION && (pathname === "/admin/pos/orders" || pathname.startsWith("/admin/pos/orders/"))) return "/admin/spa";
  return pathname;
}

// Nested routes (e.g. /admin/bookings/calendar under /admin/bookings, /admin/spa/map under
// /admin/spa) mean more than one link's href can prefix-match the current path - picking the
// single longest matching href keeps exactly one link highlighted instead of a parent and its
// child both lighting up. "/admin" (Dashboard) matches only itself, or it would prefix every page.
export function activeNavHref(links: NavLink[], pathname: string): string | undefined {
  const matching = links.filter((l) =>
    l.href === "/admin" ? pathname === "/admin" : pathname === l.href || pathname.startsWith(`${l.href}/`)
  );
  return matching.sort((a, b) => b.href.length - a.href.length)[0]?.href;
}

// The group holding the active link - the sidebar highlights it (and the accordion always opens
// it), so the current page is never hidden inside a group the viewer collapsed earlier.
export function activeNavGroupTitle(groups: NavGroup[], pathname: string): string | undefined {
  const href = activeNavHref(groups.flatMap(groupLinks), pathname);
  return groups.find((g) => groupLinks(g).some((l) => l.href === href))?.title;
}

// Which groups this viewer left open in the accordion (touch / narrow screens only - the desktop
// flyout has no open state worth remembering), remembered per browser - a convenience only, so any
// storage failure (private window, blocked site data) just falls back to "only the active group".
const OPEN_GROUPS_STORAGE_KEY = "sunset-beach:admin:nav:open-groups";

export function loadStoredOpenNavGroups(): string[] | null {
  if (typeof window === "undefined") return null;
  try {
    const parsed = JSON.parse(window.localStorage.getItem(OPEN_GROUPS_STORAGE_KEY) ?? "null");
    return Array.isArray(parsed) ? parsed.filter((t): t is string => typeof t === "string") : null;
  } catch {
    return null;
  }
}

export function saveStoredOpenNavGroups(titles: string[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(OPEN_GROUPS_STORAGE_KEY, JSON.stringify(titles));
  } catch {
    // not worth surfacing - the sidebar still works, it just won't remember
  }
}
