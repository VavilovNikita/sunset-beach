import { describe, expect, it } from "vitest";
import { visibleNavGroups } from "./adminNav";

// No group may ever render with zero links under it - a WAITER with an empty "Setup" header
// would be the exact bug this test exists to catch.
function assertNoEmptyGroups(groups: ReturnType<typeof visibleNavGroups>) {
  for (const g of groups) {
    expect(g.links.length).toBeGreaterThan(0);
  }
}

describe("visibleNavGroups", () => {
  it("WAITER sees Restaurant (POS/Print queue/Menu), Maintenance, and Staff (My schedule only)", () => {
    const groups = visibleNavGroups("WAITER");
    assertNoEmptyGroups(groups);
    expect(groups.map((g) => g.title)).toEqual(["Restaurant", "Maintenance", "Staff"]);
    expect(groups[0].links.map((l) => l.label)).toEqual(["POS", "Print queue", "Menu"]);
    expect(groups[1].links.map((l) => l.label)).toEqual(["Maintenance"]);
    // My schedule has no role floor (GET /roster/me is any authenticated staff member) - a
    // WAITER sees it even though the rest of Staff (Roster, Users) stays hidden.
    expect(groups[2].links.map((l) => l.label)).toEqual(["My schedule"]);
  });

  it("CASHIER sees Front desk, Restaurant (incl. Shifts), Setup (not Printers), Maintenance, Reports (Dashboard only), Staff (My schedule only)", () => {
    const groups = visibleNavGroups("CASHIER");
    assertNoEmptyGroups(groups);
    expect(groups.map((g) => g.title)).toEqual(["Front desk", "Restaurant", "Setup", "Maintenance", "Reports", "Staff"]);

    const byTitle = Object.fromEntries(groups.map((g) => [g.title, g.links.map((l) => l.label)]));
    expect(byTitle["Front desk"]).toEqual(["Today", "Calendar", "Bookings", "Guests", "Property map", "Housekeeping", "Spa"]);
    expect(byTitle["Restaurant"]).toEqual(["POS", "Print queue", "Shifts", "Menu"]);
    expect(byTitle["Setup"]).toEqual(["Rooms", "Pricing", "Availability"]); // no Printers - MANAGER+
    expect(byTitle["Reports"]).toEqual(["Dashboard"]); // no History - MANAGER+
    expect(byTitle["Staff"]).toEqual(["My schedule"]); // no Roster - MANAGER+, no Users - ADMIN
  });

  it("MANAGER sees the same as CASHIER plus Printers, History, and Roster", () => {
    const groups = visibleNavGroups("MANAGER");
    assertNoEmptyGroups(groups);
    expect(groups.map((g) => g.title)).toEqual(["Front desk", "Restaurant", "Setup", "Maintenance", "Reports", "Staff"]);

    const byTitle = Object.fromEntries(groups.map((g) => [g.title, g.links.map((l) => l.label)]));
    expect(byTitle["Setup"]).toContain("Printers");
    expect(byTitle["Reports"]).toContain("History");
    expect(byTitle["Staff"]).toEqual(["Roster", "My schedule"]); // no Users - ADMIN only
  });

  it("ADMIN sees everything, including Staff/Roster/My schedule/Users", () => {
    const groups = visibleNavGroups("ADMIN");
    assertNoEmptyGroups(groups);
    expect(groups.map((g) => g.title)).toEqual(["Front desk", "Restaurant", "Setup", "Maintenance", "Reports", "Staff"]);
    expect(groups.find((g) => g.title === "Staff")?.links.map((l) => l.label)).toEqual(["Roster", "My schedule", "Users"]);
  });

  it("every role's group list is a subsequence of the full six in the same relative order", () => {
    const fullOrder = ["Front desk", "Restaurant", "Setup", "Maintenance", "Reports", "Staff"];
    for (const role of ["WAITER", "CASHIER", "MANAGER", "ADMIN"] as const) {
      const titles = visibleNavGroups(role).map((g) => g.title);
      const indices = titles.map((t) => fullOrder.indexOf(t));
      expect(indices).toEqual([...indices].sort((a, b) => a - b));
    }
  });

  it("Maintenance has no role floor - every role sees it, unlike every other group with a WAITER exclusion", () => {
    for (const role of ["WAITER", "CASHIER", "MANAGER", "ADMIN"] as const) {
      expect(visibleNavGroups(role).map((g) => g.title)).toContain("Maintenance");
    }
  });
});
