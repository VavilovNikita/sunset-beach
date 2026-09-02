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
  it("WAITER sees only Restaurant, with exactly POS/Print queue/Menu (not Shifts)", () => {
    const groups = visibleNavGroups("WAITER");
    assertNoEmptyGroups(groups);
    expect(groups.map((g) => g.title)).toEqual(["Restaurant"]);
    expect(groups[0].links.map((l) => l.label)).toEqual(["POS", "Print queue", "Menu"]);
  });

  it("CASHIER sees Front desk, Restaurant (incl. Shifts), Setup (not Printers), Reports (Dashboard only) - not Staff", () => {
    const groups = visibleNavGroups("CASHIER");
    assertNoEmptyGroups(groups);
    expect(groups.map((g) => g.title)).toEqual(["Front desk", "Restaurant", "Setup", "Reports"]);

    const byTitle = Object.fromEntries(groups.map((g) => [g.title, g.links.map((l) => l.label)]));
    expect(byTitle["Front desk"]).toEqual(["Today", "Calendar", "Bookings", "Property map", "Housekeeping"]);
    expect(byTitle["Restaurant"]).toEqual(["POS", "Print queue", "Shifts", "Menu"]);
    expect(byTitle["Setup"]).toEqual(["Rooms", "Pricing", "Availability"]); // no Printers - MANAGER+
    expect(byTitle["Reports"]).toEqual(["Dashboard"]); // no History - MANAGER+
  });

  it("MANAGER sees the same five as CASHIER plus Printers and History - not Staff", () => {
    const groups = visibleNavGroups("MANAGER");
    assertNoEmptyGroups(groups);
    expect(groups.map((g) => g.title)).toEqual(["Front desk", "Restaurant", "Setup", "Reports"]);

    const byTitle = Object.fromEntries(groups.map((g) => [g.title, g.links.map((l) => l.label)]));
    expect(byTitle["Setup"]).toContain("Printers");
    expect(byTitle["Reports"]).toContain("History");
  });

  it("ADMIN sees everything, including Staff/Users", () => {
    const groups = visibleNavGroups("ADMIN");
    assertNoEmptyGroups(groups);
    expect(groups.map((g) => g.title)).toEqual(["Front desk", "Restaurant", "Setup", "Reports", "Staff"]);
    expect(groups.find((g) => g.title === "Staff")?.links.map((l) => l.label)).toEqual(["Users"]);
  });

  it("every role's group list is a subsequence of the full five in the same relative order", () => {
    const fullOrder = ["Front desk", "Restaurant", "Setup", "Reports", "Staff"];
    for (const role of ["WAITER", "CASHIER", "MANAGER", "ADMIN"] as const) {
      const titles = visibleNavGroups(role).map((g) => g.title);
      const indices = titles.map((t) => fullOrder.indexOf(t));
      expect(indices).toEqual([...indices].sort((a, b) => a - b));
    }
  });
});
