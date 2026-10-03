// The admin sidebar's link structure, as data + a pure filter - kept out of AdminSidebar.tsx so
// "does each role see the right groups, and never an empty group header" is a testable rule
// (adminNav.test.ts), not something only checked by eye in four separate browser logins.
import type { Role } from "@/lib/session";

export type NavLink = {
  href: string;
  label: string;
  // Undefined = any authenticated staff role, including WAITER (matches a backend endpoint with
  // no lower-privilege read). Otherwise the minimum role the backend actually requires.
  //
  // A job function (JobFunction, in lib/session.ts) is a second, independent axis from role, and
  // a link visible only to a function - not any role tier - is a real shape this file will need
  // again (see SecurityConfig's FUNCTION_<name>-or-role gate on the backend). No link currently
  // needs it: Maintenance turned out to belong to every authenticated role instead (any staff
  // member may file a task, not just an ENGINEER), so there is nothing here to gate on a function
  // right now. Add the field back (OR'd with minRole, not ANDed - a function should unlock a link
  // a role floor alone would hide) the day a link actually needs it, rather than carrying it
  // unused until then.
  minRole?: Exclude<Role, "WAITER">;
};

export type NavGroup = {
  title: string;
  links: NavLink[];
};

// Grouped by what someone is actually doing, not by when the feature was built - within a group,
// most-frequent-first. Today and POS lead their groups on purpose: they're the two roles' actual
// entry points (see ROLE_LANDING in app/admin/login/page.tsx), so the sidebar should already be
// pointing at them. One group per area of the hotel, plus Reports - there used to be a catch-all
// "Setup" group and a one-link "Maintenance" group, which put links next to things they had
// nothing to do with (the POS printers beside room types); every link now sits with the people
// who actually use it.
export const NAV_GROUPS: NavGroup[] = [
  {
    title: "Front desk",
    // GET /bookings, /bookings/calendar, /property-map, /room-units (housekeeping) are all
    // CASHIER+ on the backend with no lower-privilege read - a WAITER hitting any of these would
    // get a 403 (or, before an earlier regression fix, a crashed page), so these links are
    // CASHIER+ rather than shown and gated client-side. Maintenance is the one exception, below.
    links: [
      { href: "/admin/today", label: "Today", minRole: "CASHIER" },
      { href: "/admin/bookings/calendar", label: "Calendar", minRole: "CASHIER" },
      { href: "/admin/bookings", label: "Bookings", minRole: "CASHIER" },
      { href: "/admin/guests", label: "Guests", minRole: "CASHIER" },
      { href: "/admin/property-map", label: "Property map", minRole: "CASHIER" },
      { href: "/admin/housekeeping", label: "Housekeeping", minRole: "CASHIER" },
      // Room tasks (a broken air conditioner, a leak) - about the rooms, so it sits beside
      // Housekeeping rather than under Staff. Any authenticated staff role, including WAITER:
      // GET/POST /maintenance-tasks have no role floor on the backend, and the whole point is
      // that whoever notices a problem can report it, not just an ENGINEER or a manager. A hidden
      // link would mean a waiter who spots a broken air conditioner - the actual common case - has
      // no way to reach the one screen that lets them say so. (Blocking a room and moving a task
      // through its statuses stay MANAGER+ / the ENGINEER function respectively - gated inside the
      // page itself, per action, not by hiding the page.) The only Front desk link a WAITER sees.
      { href: "/admin/maintenance", label: "Maintenance" },
      // GET /night-audit and POST /night-audit/close are CASHIER+ - the daily close is routine
      // front-desk work, not a MANAGER+ report.
      { href: "/admin/night-audit", label: "Night audit", minRole: "CASHIER" },
      // GET /reports/in-house is the one CASHIER+ report - the daily list of who is in which room.
      { href: "/admin/in-house", label: "In house", minRole: "CASHIER" },
      // Configuring what's for sale - prices and RoomUnitBlocks (the merged Pricing + Availability
      // month table; /admin/pricing and /admin/availability redirect to it), then the room types
      // themselves. Not per-guest work, so they come after it, but it's the front desk that sells
      // these rooms, on the same CASHIER+ floor - their per-booking view is Calendar.
      { href: "/admin/rates", label: "Rates & availability", minRole: "CASHIER" },
      { href: "/admin/rooms", label: "Rooms", minRole: "CASHIER" },
      // Automated pre-arrival/post-stay/win-back emails to guests with a verified account - about
      // the guest's stay, nothing to do with the restaurant. ADMIN-only: GET/PUT
      // /settings/lifecycle-emails has no lower-privilege read, since it decides what automated
      // email reaches every eligible guest.
      { href: "/admin/settings/lifecycle-emails", label: "Guest emails", minRole: "ADMIN" },
    ],
  },
  {
    title: "Restaurant",
    // POS, the print queue, and the menu are open to any staff role, including WAITER - a waiter
    // genuinely uses all three to do their own job (take orders, check a failed kitchen ticket,
    // look up a menu item), even though only a MANAGER can edit the menu itself. Shifts is
    // CASHIER+ (cash-drawer open/close), matching GET /shifts/current. Printers is MANAGER+
    // (registering/editing physical hardware) - the kitchen/bar/receipt printers the POS prints
    // to, so it lives beside Print queue.
    links: [
      { href: "/admin/pos", label: "POS" },
      { href: "/admin/pos/print-jobs", label: "Print queue" },
      { href: "/admin/pos/shifts", label: "Shifts", minRole: "CASHIER" },
      { href: "/admin/pos/menu", label: "Menu" },
      { href: "/admin/pos/printers", label: "Printers", minRole: "MANAGER" },
    ],
  },
  {
    title: "Spa",
    // GET /spa-appointments, the live table map and the treatment list are CASHIER+ - reception is
    // the only spa surface in v1 (no therapist self-service, see JobFunction.THERAPIST). Tables
    // (the raw CRUD list, no live-occupancy value) is MANAGER+, matching its page's own gate.
    links: [
      { href: "/admin/spa", label: "Appointments", minRole: "CASHIER" },
      { href: "/admin/spa/map", label: "Table map", minRole: "CASHIER" },
      { href: "/admin/spa/treatments", label: "Treatments", minRole: "CASHIER" },
      { href: "/admin/spa/tables", label: "Tables", minRole: "MANAGER" },
    ],
  },
  {
    title: "Reports",
    // Dashboard belongs here, not Front desk: every figure on it (bookings/occupancy/revenue,
    // POS revenue) comes from the same CASHIER+ reads as the rest of this group, and it answers
    // "how are we doing", not "what do I do right now" - that's Today's job. History (the audit
    // log) is MANAGER+ - GET /audit-log has no lower-privilege read. Room production is MANAGER+
    // too - GET /reports/top-production and /reports/market-segment share the revenue export's floor.
    // Manager report (GET /reports/manager) is MANAGER+ like the rest of /reports/* - so it lives
    // here, not beside the CASHIER+ Night audit / In house under Front desk.
    links: [
      { href: "/admin", label: "Dashboard", minRole: "CASHIER" },
      { href: "/admin/reports", label: "Room production", minRole: "MANAGER" },
      { href: "/admin/manager-report", label: "Manager report", minRole: "MANAGER" },
      { href: "/admin/history", label: "History", minRole: "MANAGER" },
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
      { href: "/admin/roster", label: "Roster", minRole: "MANAGER" },
      { href: "/admin/schedule", label: "My schedule" },
      { href: "/admin/attendance-devices", label: "Fingerprint terminals", minRole: "MANAGER" },
      { href: "/admin/roster/import", label: "Import schedule", minRole: "ADMIN" },
      { href: "/admin/users", label: "Users", minRole: "ADMIN" },
    ],
  },
];

function meetsMinRole(minRole: Exclude<Role, "WAITER">, role: Role): boolean {
  if (minRole === "CASHIER") return role !== "WAITER";
  if (minRole === "MANAGER") return role === "MANAGER" || role === "ADMIN";
  return role === "ADMIN";
}

export function isNavLinkVisible(link: NavLink, role: Role): boolean {
  return !link.minRole || meetsMinRole(link.minRole, role);
}

// Every group's links filtered to what this role may see, with any group left with zero links
// dropped entirely - a group header must never render with nothing under it.
export function visibleNavGroups(role: Role): NavGroup[] {
  return NAV_GROUPS.map((g) => ({ ...g, links: g.links.filter((l) => isNavLinkVisible(l, role)) })).filter(
    (g) => g.links.length > 0
  );
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

// The group holding the active link - the sidebar always opens it, so the highlighted link is
// never hidden inside a group the viewer collapsed earlier.
export function activeNavGroupTitle(groups: NavGroup[], pathname: string): string | undefined {
  const href = activeNavHref(groups.flatMap((g) => g.links), pathname);
  return groups.find((g) => g.links.some((l) => l.href === href))?.title;
}

// Which groups this viewer left open, remembered per browser - a convenience only, so any
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
