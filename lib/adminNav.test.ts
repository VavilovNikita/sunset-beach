import { describe, expect, it } from "vitest";
import { NAV_GROUPS, activeNavGroupTitle, activeNavHref, navPathname, visibleNavGroups } from "./adminNav";

// No group may ever render with zero links under it - a WAITER with an empty "Spa" header
// would be the exact bug this test exists to catch.
function assertNoEmptyGroups(groups: ReturnType<typeof visibleNavGroups>) {
  for (const g of groups) {
    expect(g.links.length).toBeGreaterThan(0);
  }
}

const FULL_ORDER = ["Front desk", "Restaurant", "Spa", "Reports", "Staff"];

describe("visibleNavGroups with a job function", () => {
  it("shows a WAITER who is a THERAPIST the Appointments link and nothing else of Spa", () => {
    const groups = visibleNavGroups("WAITER", ["THERAPIST"]);
    assertNoEmptyGroups(groups);
    const spa = groups.find((g) => g.title === "Spa");
    expect(spa?.links.map((l) => l.label)).toEqual(["Appointments"]);
    // The function opens that one link, not the rest of what a CASHIER sees.
    expect(groups.map((g) => g.title)).toEqual(["Front desk", "Restaurant", "Spa", "Staff"]);
    expect(groups[0].links.map((l) => l.label)).toEqual(["Maintenance"]);
  });

  it("does not show Spa to a WAITER with another function, or none", () => {
    expect(visibleNavGroups("WAITER", ["ENGINEER", "HOUSEKEEPER"]).map((g) => g.title)).not.toContain("Spa");
    expect(visibleNavGroups("WAITER").map((g) => g.title)).not.toContain("Spa");
  });
});

describe("visibleNavGroups", () => {
  it("WAITER sees Front desk (Maintenance only), Restaurant (POS/Print queue/Menu), and Staff (My schedule only)", () => {
    const groups = visibleNavGroups("WAITER");
    assertNoEmptyGroups(groups);
    expect(groups.map((g) => g.title)).toEqual(["Front desk", "Restaurant", "Staff"]);
    // Maintenance has no role floor - whoever notices a broken air conditioner can report it.
    expect(groups[0].links.map((l) => l.label)).toEqual(["Maintenance"]);
    expect(groups[1].links.map((l) => l.label)).toEqual(["POS", "Print queue", "Menu"]);
    // My schedule has no role floor (GET /roster/me is any authenticated staff member) - a
    // WAITER sees it even though the rest of Staff (Roster, Users) stays hidden.
    expect(groups[2].links.map((l) => l.label)).toEqual(["My schedule"]);
  });

  it("CASHIER sees Front desk, Restaurant (incl. Shifts, not Printers), Spa (not Tables), Reports (Dashboard only), Staff (My schedule only)", () => {
    const groups = visibleNavGroups("CASHIER");
    assertNoEmptyGroups(groups);
    expect(groups.map((g) => g.title)).toEqual(FULL_ORDER);

    const byTitle = Object.fromEntries(groups.map((g) => [g.title, g.links.map((l) => l.label)]));
    expect(byTitle["Front desk"]).toEqual([
      "Today", "Calendar", "Bookings", "Guests", "Property map", "Housekeeping", "Gym", "Gym schedule", "Maintenance",
      "Night audit", "In house", "Rates & availability", "Rooms",
    ]); // no Guest emails - ADMIN only
    expect(byTitle["Restaurant"]).toEqual(["POS", "Print queue", "Shifts", "Menu"]); // no Printers - MANAGER+
    expect(byTitle["Spa"]).toEqual(["Appointments", "Table map", "Treatments"]); // no Tables - MANAGER+
    expect(byTitle["Reports"]).toEqual(["Dashboard"]); // no History - MANAGER+
    expect(byTitle["Staff"]).toEqual(["My schedule"]); // no Roster - MANAGER+, no Users - ADMIN
  });

  it("MANAGER sees the same as CASHIER plus Printers, spa Tables, the MANAGER+ reports, Roster and Fingerprint terminals", () => {
    const groups = visibleNavGroups("MANAGER");
    assertNoEmptyGroups(groups);
    expect(groups.map((g) => g.title)).toEqual(FULL_ORDER);

    const byTitle = Object.fromEntries(groups.map((g) => [g.title, g.links.map((l) => l.label)]));
    expect(byTitle["Front desk"]).not.toContain("Guest emails"); // ADMIN only
    expect(byTitle["Restaurant"]).not.toContain("Print layouts"); // ADMIN only
    expect(byTitle["Restaurant"]).toEqual(["POS", "Print queue", "Shifts", "Menu", "Printers"]);
    expect(byTitle["Spa"]).toEqual(["Appointments", "Table map", "Treatments", "Tables"]);
    expect(byTitle["Reports"]).toEqual(["Dashboard", "Room production", "Manager report", "History"]);
    expect(byTitle["Staff"]).toEqual(["Roster", "My schedule", "Fingerprint terminals"]); // no Import schedule/Users - ADMIN only
  });

  it("ADMIN sees everything, including Guest emails, Import schedule and Users", () => {
    const groups = visibleNavGroups("ADMIN");
    assertNoEmptyGroups(groups);
    expect(groups.map((g) => g.title)).toEqual(FULL_ORDER);
    expect(groups.find((g) => g.title === "Staff")?.links.map((l) => l.label)).toEqual([
      "Roster", "My schedule", "Fingerprint terminals", "Import schedule", "Users",
    ]);
    expect(groups.find((g) => g.title === "Front desk")?.links.map((l) => l.label)).toContain("Guest emails");
    expect(groups.find((g) => g.title === "Restaurant")?.links.map((l) => l.label)).toContain("Print layouts");
    expect(groups.flatMap((g) => g.links)).toHaveLength(NAV_GROUPS.flatMap((g) => g.links).length);
  });

  it("every role's group list is a subsequence of the full five in the same relative order", () => {
    for (const role of ["WAITER", "CASHIER", "MANAGER", "ADMIN"] as const) {
      const titles = visibleNavGroups(role).map((g) => g.title);
      const indices = titles.map((t) => FULL_ORDER.indexOf(t));
      expect(indices).not.toContain(-1);
      expect(indices).toEqual([...indices].sort((a, b) => a - b));
    }
  });

  it("Maintenance has no role floor - every role sees it", () => {
    for (const role of ["WAITER", "CASHIER", "MANAGER", "ADMIN"] as const) {
      expect(visibleNavGroups(role).flatMap((g) => g.links.map((l) => l.label))).toContain("Maintenance");
    }
  });

  it("Gym is CASHIER+ and its device list ADMIN-only - a WAITER sees neither", () => {
    const labels = (role: "WAITER" | "CASHIER" | "MANAGER" | "ADMIN") => visibleNavGroups(role).flatMap((g) => g.links.map((l) => l.label));
    expect(labels("WAITER")).not.toContain("Gym");
    expect(labels("CASHIER")).toContain("Gym");
    expect(labels("CASHIER")).not.toContain("Gym devices");
    expect(labels("MANAGER")).not.toContain("Gym devices");
    expect(labels("ADMIN")).toEqual(expect.arrayContaining(["Gym", "Gym devices"]));
  });

  it("Lighting is MANAGER+ and its controller list ADMIN-only - a CASHIER sees neither", () => {
    const labels = (role: "WAITER" | "CASHIER" | "MANAGER" | "ADMIN") => visibleNavGroups(role).flatMap((g) => g.links.map((l) => l.label));
    for (const role of ["WAITER", "CASHIER"] as const) {
      expect(labels(role)).not.toContain("Lighting");
      expect(labels(role)).not.toContain("Lighting devices");
    }
    expect(labels("MANAGER")).toContain("Lighting");
    expect(labels("MANAGER")).not.toContain("Lighting devices");
    expect(labels("ADMIN")).toEqual(expect.arrayContaining(["Lighting", "Lighting devices"]));
  });

  it("the lighting links sit in Front desk next to the gym ones", () => {
    const frontDesk = visibleNavGroups("ADMIN").find((g) => g.title === "Front desk")!.links.map((l) => l.label);
    expect(frontDesk.indexOf("Lighting")).toBe(frontDesk.indexOf("Gym devices") + 1);
    expect(frontDesk.indexOf("Lighting devices")).toBe(frontDesk.indexOf("Lighting") + 1);
  });

  it("the Lighting settings page highlights its own link, not the board's", () => {
    const links = visibleNavGroups("ADMIN").flatMap((g) => g.links);
    expect(activeNavHref(links, "/admin/lighting")).toBe("/admin/lighting");
    expect(activeNavHref(links, "/admin/lighting/settings")).toBe("/admin/lighting/settings");
  });

  it("the Gym settings page highlights its own link, not the Gym board's", () => {
    const links = visibleNavGroups("ADMIN").flatMap((g) => g.links);
    expect(activeNavHref(links, "/admin/gym")).toBe("/admin/gym");
    expect(activeNavHref(links, "/admin/gym/settings")).toBe("/admin/gym/settings");
  });

  it("the Gym schedule sits next to Gym for CASHIER+ and highlights its own link", () => {
    const labels = (role: "WAITER" | "CASHIER") => visibleNavGroups(role).flatMap((g) => g.links.map((l) => l.label));
    expect(labels("WAITER")).not.toContain("Gym schedule");
    expect(labels("CASHIER")).toContain("Gym schedule");
    const links = visibleNavGroups("ADMIN").flatMap((g) => g.links);
    expect(activeNavHref(links, "/admin/gym/schedule")).toBe("/admin/gym/schedule");
    expect(activeNavHref(links, "/admin/gym")).toBe("/admin/gym");
  });

  it("no href appears twice - one page, one place in the menu", () => {
    const hrefs = NAV_GROUPS.flatMap((g) => g.links.map((l) => l.href));
    expect(new Set(hrefs).size).toBe(hrefs.length);
  });
});

describe("activeNavHref / activeNavGroupTitle", () => {
  const groups = visibleNavGroups("ADMIN");
  const links = groups.flatMap((g) => g.links);

  it.each([
    ["/admin", "/admin", "Reports"],
    ["/admin/bookings", "/admin/bookings", "Front desk"],
    ["/admin/bookings/123", "/admin/bookings", "Front desk"],
    // the child link wins over its parent, not both lit
    ["/admin/bookings/calendar", "/admin/bookings/calendar", "Front desk"],
    ["/admin/spa", "/admin/spa", "Spa"],
    ["/admin/spa/map", "/admin/spa/map", "Spa"],
    ["/admin/spa/treatments/abc/edit", "/admin/spa/treatments", "Spa"],
    ["/admin/pos/orders/42", "/admin/pos", "Restaurant"],
    ["/admin/pos/printers", "/admin/pos/printers", "Restaurant"],
    ["/admin/roster/import", "/admin/roster/import", "Staff"],
    ["/admin/settings/lifecycle-emails", "/admin/settings/lifecycle-emails", "Front desk"],
    ["/admin/settings/print-layouts", "/admin/settings/print-layouts", "Restaurant"],
    ["/admin/rooms/7/edit", "/admin/rooms", "Front desk"],
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
    expect(activeNavHref(groups.flatMap((g) => g.links), path)).toBe("/admin/spa");
  });

  it("leaves a restaurant ticket, and every other page, where its URL puts it", () => {
    expect(navPathname("/admin/pos/orders/abc", null)).toBe("/admin/pos/orders/abc");
    expect(navPathname("/admin/pos/orders/abc", "restaurant")).toBe("/admin/pos/orders/abc");
    expect(navPathname("/admin/bookings", "spa")).toBe("/admin/bookings");
  });
});
