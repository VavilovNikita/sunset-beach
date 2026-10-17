import { describe, expect, it } from "vitest";
import {
  NAV_GROUPS,
  activeNavGroupTitle,
  activeNavHref,
  groupLinks,
  navPathname,
  navSections,
  visibleNavGroups,
  type NavGroup,
} from "./adminNav";
import type { JobFunction, Role } from "./session";

const ROLES = ["WAITER", "CASHIER", "MANAGER", "ADMIN"] as const;
const FUNCTION_SETS: JobFunction[][] = [[], ["ENGINEER"], ["HOUSEKEEPER"], ["THERAPIST"], ["ENGINEER", "HOUSEKEEPER", "THERAPIST"]];

// No group and no section may ever render with zero links under it - a WAITER with an empty "Spa"
// header would be the exact bug this test exists to catch.
function assertNothingEmpty(groups: ReturnType<typeof visibleNavGroups>) {
  for (const g of groups) {
    expect(groupLinks(g).length).toBeGreaterThan(0);
    for (const section of navSections(g).sections) expect(section.length).toBeGreaterThan(0);
  }
}

const FULL_ORDER = ["Front desk", "Rooms", "Restaurant", "Spa", "Gym & lighting", "Staff", "Reports"];

const labels = (group: NavGroup | undefined) => (group ? groupLinks(group).map((l) => l.label) : []);
const byTitle = (role: Role, functions: JobFunction[] = []) =>
  Object.fromEntries(visibleNavGroups(role, functions).map((g) => [g.title, labels(g)]));
const allLabels = (role: Role) => Object.values(byTitle(role)).flat();

describe("no empty group or section, for any role or function", () => {
  it.each(ROLES.flatMap((role) => FUNCTION_SETS.map((fns) => [role, fns] as const)))("%s with %j", (role, fns) => {
    assertNothingEmpty(visibleNavGroups(role, fns));
  });
});

describe("navSections", () => {
  const link = (label: string) => ({ href: `/admin/${label}`, label });

  it("draws a divider only when both sections have links", () => {
    expect(navSections({ title: "G", links: [link("a")], setup: [link("b")] }).divider).toBe(true);
    expect(navSections({ title: "G", links: [link("a")], setup: [] }).divider).toBe(false);
  });

  it("a group left with only its setup links is one plain list, no divider", () => {
    const only = navSections({ title: "G", links: [], setup: [link("b"), link("c")] });
    expect(only.divider).toBe(false);
    expect(only.sections).toHaveLength(1);
    expect(only.sections[0].map((l) => l.label)).toEqual(["b", "c"]);
  });

  it("a real role sees the divider where it has both kinds of link", () => {
    const rooms = (role: Role) => visibleNavGroups(role).find((g) => g.title === "Rooms")!;
    expect(navSections(rooms("CASHIER")).divider).toBe(true); // Housekeeping... + Rooms
    expect(navSections(rooms("WAITER")).divider).toBe(false); // Maintenance only
  });
});

describe("visibleNavGroups with a job function", () => {
  it("shows a WAITER who is a THERAPIST the Appointments link and nothing else of Spa", () => {
    const groups = visibleNavGroups("WAITER", ["THERAPIST"]);
    assertNothingEmpty(groups);
    expect(labels(groups.find((g) => g.title === "Spa"))).toEqual(["Appointments"]);
    // The function opens that one link, not the rest of what a CASHIER sees.
    expect(groups.map((g) => g.title)).toEqual(["Rooms", "Restaurant", "Spa", "Staff"]);
    expect(labels(groups[0])).toEqual(["Maintenance"]);
  });

  it("does not show Spa to a WAITER with another function, or none", () => {
    expect(visibleNavGroups("WAITER", ["ENGINEER", "HOUSEKEEPER"]).map((g) => g.title)).not.toContain("Spa");
    expect(visibleNavGroups("WAITER").map((g) => g.title)).not.toContain("Spa");
  });
});

describe("visibleNavGroups", () => {
  it("WAITER sees Restaurant (POS/Print queue/Menu), Rooms (Maintenance only) and Staff (My schedule only)", () => {
    const groups = visibleNavGroups("WAITER");
    assertNothingEmpty(groups);
    expect(groups.map((g) => g.title)).toEqual(["Rooms", "Restaurant", "Staff"]);
    // Maintenance has no role floor - whoever notices a broken air conditioner can report it.
    expect(labels(groups[0])).toEqual(["Maintenance"]);
    expect(labels(groups[1])).toEqual(["POS", "Print queue", "Menu"]);
    // My schedule has no role floor (GET /roster/me is any authenticated staff member) - a
    // WAITER sees it even though the rest of Staff (Roster, Users) stays hidden.
    expect(labels(groups[2])).toEqual(["My schedule"]);
  });

  it("CASHIER sees the everyday links, none of the MANAGER+/ADMIN ones", () => {
    const groups = visibleNavGroups("CASHIER");
    assertNothingEmpty(groups);
    expect(groups.map((g) => g.title)).toEqual(FULL_ORDER);
    const t = byTitle("CASHIER");
    expect(t["Front desk"]).toEqual(["Today", "Calendar", "Bookings", "Guests", "Property map", "In house", "Night audit"]); // no Guest emails - ADMIN
    expect(t["Rooms"]).toEqual(["Housekeeping", "Maintenance", "Rates & availability", "Rooms"]);
    expect(t["Restaurant"]).toEqual(["POS", "Print queue", "Shifts", "Menu"]); // no Printers - MANAGER+
    expect(t["Spa"]).toEqual(["Appointments", "Table map", "Treatments"]); // no Tables - MANAGER+
    expect(t["Gym & lighting"]).toEqual(["Gym schedule", "Gym"]); // no Lighting - MANAGER+, no devices - ADMIN
    expect(t["Staff"]).toEqual(["My schedule"]); // no Roster - MANAGER+
    expect(t["Reports"]).toEqual(["Dashboard"]); // no History - MANAGER+
  });

  it("MANAGER sees the same as CASHIER plus Printers, spa Tables, Lighting, the MANAGER+ reports, Roster and the terminals", () => {
    const groups = visibleNavGroups("MANAGER");
    assertNothingEmpty(groups);
    expect(groups.map((g) => g.title)).toEqual(FULL_ORDER);
    const t = byTitle("MANAGER");
    expect(t["Front desk"]).not.toContain("Guest emails"); // ADMIN only
    expect(t["Restaurant"]).toEqual(["POS", "Print queue", "Shifts", "Menu", "Printers"]); // no Print layouts - ADMIN
    expect(t["Spa"]).toEqual(["Appointments", "Table map", "Treatments", "Tables"]);
    expect(t["Gym & lighting"]).toEqual(["Gym schedule", "Gym", "Lighting"]);
    expect(t["Staff"]).toEqual(["My schedule", "Roster", "Notifications", "Notification channels", "Fingerprint terminals"]);
    expect(t["Reports"]).toEqual(["Dashboard", "Room production", "Manager report", "History"]);
  });

  it("ADMIN sees everything, everyday links first and setup links after them", () => {
    const groups = visibleNavGroups("ADMIN");
    assertNothingEmpty(groups);
    expect(groups.map((g) => g.title)).toEqual(FULL_ORDER);
    const t = byTitle("ADMIN");
    expect(t["Front desk"]).toEqual(["Today", "Calendar", "Bookings", "Guests", "Property map", "In house", "Night audit", "Guest emails"]);
    expect(t["Gym & lighting"]).toEqual(["Gym schedule", "Gym", "Lighting", "Gym devices", "Lighting devices"]);
    expect(t["Staff"]).toEqual([
      "My schedule", "Roster", "Notifications", "Notification channels",
      "Fingerprint terminals", "Import schedule", "Users", "Notification settings",
    ]);
    expect(t["Restaurant"]).toEqual(["POS", "Print queue", "Shifts", "Menu", "Printers", "Print layouts"]);
    expect(groups.flatMap(groupLinks)).toHaveLength(NAV_GROUPS.flatMap(groupLinks).length);
  });

  it("settings stay with their own area - the setup links are the ones listed in the plan", () => {
    const setup = Object.fromEntries(NAV_GROUPS.map((g) => [g.title, g.setup.map((l) => l.label)]));
    expect(setup).toEqual({
      "Front desk": ["Guest emails"],
      Rooms: ["Rooms"],
      Restaurant: ["Printers", "Print layouts"],
      Spa: ["Tables"],
      "Gym & lighting": ["Gym devices", "Lighting devices"],
      Staff: ["Fingerprint terminals", "Import schedule", "Users", "Notification settings"],
      Reports: [],
    });
    expect(NAV_GROUPS.map((g) => g.title)).not.toContain("Setup");
  });

  it("the notification pages each highlight their own link, not their parent's", () => {
    const links = visibleNavGroups("ADMIN").flatMap(groupLinks);
    expect(activeNavHref(links, "/admin/notifications")).toBe("/admin/notifications");
    expect(activeNavHref(links, "/admin/notifications/staff")).toBe("/admin/notifications/staff");
    expect(activeNavHref(links, "/admin/settings/notifications")).toBe("/admin/settings/notifications");
  });

  it("every role's group list is a subsequence of the full seven in the same relative order", () => {
    for (const role of ROLES) {
      const indices = visibleNavGroups(role).map((g) => FULL_ORDER.indexOf(g.title));
      expect(indices).not.toContain(-1);
      expect(indices).toEqual([...indices].sort((a, b) => a - b));
    }
  });

  it("Maintenance has no role floor - every role sees it", () => {
    for (const role of ROLES) expect(allLabels(role)).toContain("Maintenance");
  });

  it("Gym is CASHIER+ and its device list ADMIN-only - a WAITER sees neither", () => {
    expect(allLabels("WAITER")).not.toContain("Gym");
    expect(allLabels("CASHIER")).toContain("Gym");
    expect(allLabels("CASHIER")).not.toContain("Gym devices");
    expect(allLabels("MANAGER")).not.toContain("Gym devices");
    expect(allLabels("ADMIN")).toEqual(expect.arrayContaining(["Gym", "Gym devices"]));
  });

  it("Lighting is MANAGER+ and its controller list ADMIN-only - a CASHIER sees neither", () => {
    for (const role of ["WAITER", "CASHIER"] as const) {
      expect(allLabels(role)).not.toContain("Lighting");
      expect(allLabels(role)).not.toContain("Lighting devices");
    }
    expect(allLabels("MANAGER")).toContain("Lighting");
    expect(allLabels("MANAGER")).not.toContain("Lighting devices");
    expect(allLabels("ADMIN")).toEqual(expect.arrayContaining(["Lighting", "Lighting devices"]));
  });

  it("the Lighting and Gym settings pages highlight their own link, not the board's", () => {
    const links = visibleNavGroups("ADMIN").flatMap(groupLinks);
    expect(activeNavHref(links, "/admin/lighting")).toBe("/admin/lighting");
    expect(activeNavHref(links, "/admin/lighting/settings")).toBe("/admin/lighting/settings");
    expect(activeNavHref(links, "/admin/gym")).toBe("/admin/gym");
    expect(activeNavHref(links, "/admin/gym/settings")).toBe("/admin/gym/settings");
    expect(activeNavHref(links, "/admin/gym/schedule")).toBe("/admin/gym/schedule");
  });

  it("no href appears twice - one page, one place in the menu", () => {
    const hrefs = NAV_GROUPS.flatMap(groupLinks).map((l) => l.href);
    expect(new Set(hrefs).size).toBe(hrefs.length);
  });
});

describe("activeNavHref / activeNavGroupTitle", () => {
  const groups = visibleNavGroups("ADMIN");
  const links = groups.flatMap(groupLinks);

  it.each([
    ["/admin", "/admin", "Reports"],
    ["/admin/bookings", "/admin/bookings", "Front desk"],
    ["/admin/bookings/123", "/admin/bookings", "Front desk"],
    // the child link wins over its parent, not both lit
    ["/admin/bookings/calendar", "/admin/bookings/calendar", "Front desk"],
    ["/admin/housekeeping", "/admin/housekeeping", "Rooms"],
    ["/admin/maintenance", "/admin/maintenance", "Rooms"],
    ["/admin/rates", "/admin/rates", "Rooms"],
    ["/admin/spa", "/admin/spa", "Spa"],
    ["/admin/spa/map", "/admin/spa/map", "Spa"],
    ["/admin/spa/treatments/abc/edit", "/admin/spa/treatments", "Spa"],
    ["/admin/gym", "/admin/gym", "Gym & lighting"],
    ["/admin/lighting/settings", "/admin/lighting/settings", "Gym & lighting"],
    ["/admin/pos/orders/42", "/admin/pos", "Restaurant"],
    ["/admin/pos/printers", "/admin/pos/printers", "Restaurant"],
    ["/admin/roster/import", "/admin/roster/import", "Staff"],
    ["/admin/settings/lifecycle-emails", "/admin/settings/lifecycle-emails", "Front desk"],
    ["/admin/settings/print-layouts", "/admin/settings/print-layouts", "Restaurant"],
    ["/admin/rooms/7/edit", "/admin/rooms", "Rooms"],
  ])("%s highlights %s in %s", (pathname, href, group) => {
    expect(activeNavHref(links, pathname)).toBe(href);
    expect(activeNavGroupTitle(groups, pathname)).toBe(group);
  });

  it("a page with no menu link (Account) highlights nothing - Dashboard's /admin must not prefix-match it", () => {
    expect(activeNavHref(links, "/admin/account")).toBeUndefined();
    expect(activeNavGroupTitle(groups, "/admin/account")).toBeUndefined();
  });

  it("/admin/roomsX is not under /admin/rooms", () => {
    expect(activeNavHref(links, "/admin/roomsX")).toBeUndefined();
  });
});

describe("navPathname", () => {
  it("keeps a spa billing ticket on the Spa section of the sidebar", () => {
    const groups = visibleNavGroups("CASHIER");
    const path = navPathname("/admin/pos/orders/abc", "spa");
    expect(path).toBe("/admin/spa");
    expect(activeNavGroupTitle(groups, path)).toBe("Spa");
    expect(activeNavHref(groups.flatMap(groupLinks), path)).toBe("/admin/spa");
  });

  it("leaves a restaurant ticket, and every other page, where its URL puts it", () => {
    expect(navPathname("/admin/pos/orders/abc", null)).toBe("/admin/pos/orders/abc");
    expect(navPathname("/admin/pos/orders/abc", "restaurant")).toBe("/admin/pos/orders/abc");
    expect(navPathname("/admin/bookings", "spa")).toBe("/admin/bookings");
  });
});
