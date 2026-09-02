// The admin sidebar's link structure, as data + a pure filter - kept out of AdminSidebar.tsx so
// "does each role see the right groups, and never an empty group header" is a testable rule
// (adminNav.test.ts), not something only checked by eye in four separate browser logins.
import type { Role } from "@/lib/session";

export type NavLink = {
  href: string;
  label: string;
  // Undefined = any authenticated staff role, including WAITER (matches a backend endpoint with
  // no lower-privilege read). Otherwise the minimum role the backend actually requires.
  minRole?: Exclude<Role, "WAITER">;
};

export type NavGroup = {
  title: string;
  links: NavLink[];
};

// Grouped by what someone is actually doing, not by when the feature was built - within a group,
// most-frequent-first. Today and POS lead their groups on purpose: they're the two roles' actual
// entry points (see ROLE_LANDING in app/admin/login/page.tsx), so the sidebar should already be
// pointing at them.
export const NAV_GROUPS: NavGroup[] = [
  {
    title: "Front desk",
    // GET /bookings, /bookings/calendar, /property-map, /room-units (housekeeping) are all
    // CASHIER+ on the backend with no lower-privilege read - a WAITER hitting any of these would
    // get a 403 (or, before an earlier regression fix, a crashed page), so the whole group is
    // CASHIER+ rather than shown and gated client-side.
    links: [
      { href: "/admin/today", label: "Today", minRole: "CASHIER" },
      { href: "/admin/bookings/calendar", label: "Calendar", minRole: "CASHIER" },
      { href: "/admin/bookings", label: "Bookings", minRole: "CASHIER" },
      { href: "/admin/property-map", label: "Property map", minRole: "CASHIER" },
      { href: "/admin/housekeeping", label: "Housekeeping", minRole: "CASHIER" },
    ],
  },
  {
    title: "Restaurant",
    // POS, the print queue, and the menu are open to any staff role, including WAITER - a waiter
    // genuinely uses all three to do their own job (take orders, check a failed kitchen ticket,
    // look up a menu item), even though only a MANAGER can edit the menu itself. Shifts is the
    // one CASHIER+ exception here (cash-drawer open/close), matching GET /shifts/current.
    links: [
      { href: "/admin/pos", label: "POS" },
      { href: "/admin/pos/print-jobs", label: "Print queue" },
      { href: "/admin/pos/shifts", label: "Shifts", minRole: "CASHIER" },
      { href: "/admin/pos/menu", label: "Menu" },
    ],
  },
  {
    title: "Setup",
    // Configuring the property/inventory, not day-to-day guest work - Availability lives here
    // rather than Front desk because its actual job is managing RoomUnitBlocks and monthly
    // inventory, not something reception does per guest. Printers is the one MANAGER+ exception
    // (registering/editing physical hardware); Rooms/Pricing/Availability are CASHIER+.
    links: [
      { href: "/admin/rooms", label: "Rooms", minRole: "CASHIER" },
      { href: "/admin/pricing", label: "Pricing", minRole: "CASHIER" },
      { href: "/admin/availability", label: "Availability", minRole: "CASHIER" },
      { href: "/admin/pos/printers", label: "Printers", minRole: "MANAGER" },
    ],
  },
  {
    title: "Reports",
    // Dashboard belongs here, not Front desk: every figure on it (bookings/occupancy/revenue,
    // POS revenue) comes from the same CASHIER+ reads as the rest of this group, and it answers
    // "how are we doing", not "what do I do right now" - that's Today's job. History (the audit
    // log) is MANAGER+ - GET /audit-log has no lower-privilege read.
    links: [
      { href: "/admin", label: "Dashboard", minRole: "CASHIER" },
      { href: "/admin/history", label: "History", minRole: "MANAGER" },
    ],
  },
  {
    title: "Staff",
    // GET /users is ADMIN-only on the backend, hard-restricted regardless of the role hierarchy.
    links: [{ href: "/admin/users", label: "Users", minRole: "ADMIN" }],
  },
];

export function isNavLinkVisible(link: NavLink, role: Role): boolean {
  if (!link.minRole) return true;
  if (link.minRole === "CASHIER") return role !== "WAITER";
  if (link.minRole === "MANAGER") return role === "MANAGER" || role === "ADMIN";
  return role === "ADMIN";
}

// Every group's links filtered to what this role may see, with any group left with zero links
// dropped entirely - a group header must never render with nothing under it.
export function visibleNavGroups(role: Role): NavGroup[] {
  return NAV_GROUPS.map((g) => ({ ...g, links: g.links.filter((l) => isNavLinkVisible(l, role)) })).filter(
    (g) => g.links.length > 0
  );
}
