import { describe, expect, it } from "vitest";
import { NAV_GROUPS, activeNavGroupTitle, activeNavHref, visibleNavGroups } from "./adminNav";

// No group may ever render with zero links under it - a WAITER with an empty "Spa" header
// would be the exact bug this test exists to catch.
function assertNoEmptyGroups(groups: ReturnType<typeof visibleNavGroups>) {
  for (const g of groups) {
    expect(g.links.length).toBeGreaterThan(0);
  }
}

const FULL_ORDER = ["Front desk", "Restaurant", "Spa", "Reports", "Staff"];

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
      "Today", "Calendar", "Bookings", "Guests", "Property map", "Housekeeping", "Maintenance",
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
