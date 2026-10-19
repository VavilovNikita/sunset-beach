import { describe, expect, it } from "vitest";
import { ROSTER_TABS, canEditRoster, canOpenRoster, parseRosterTab, visibleRosterTabs } from "./rosterAccess";

describe("who may open and edit the roster", () => {
  it("lets MANAGER+ edit and everyone else only read", () => {
    expect(canEditRoster("ADMIN")).toBe(true);
    expect(canEditRoster("MANAGER")).toBe(true);
    // The HR function never makes anyone an editor - it is a read gate on the backend.
    expect(canEditRoster("CASHIER")).toBe(false);
    expect(canEditRoster("WAITER")).toBe(false);
  });

  it("opens the page to MANAGER+ or the HR function only", () => {
    expect(canOpenRoster("WAITER", [])).toBe(false);
    expect(canOpenRoster("CASHIER", ["THERAPIST", "ENGINEER"])).toBe(false);
    expect(canOpenRoster("WAITER", ["HR"])).toBe(true);
    expect(canOpenRoster("MANAGER", [])).toBe(true);
  });

  it("gives the HR director only the tabs the backend lets them read", () => {
    expect(visibleRosterTabs("MANAGER")).toBe(ROSTER_TABS);
    expect(visibleRosterTabs("WAITER").map((t) => t.key)).toEqual(["grid", "attendance"]);
    expect(visibleRosterTabs("CASHIER").map((t) => t.key)).toEqual(["grid", "attendance"]);
  });

  it("sends a tab that is not offered to the grid, for that reader only", () => {
    expect(parseRosterTab("payrates", "MANAGER")).toBe("payrates");
    expect(parseRosterTab("payrates", "WAITER")).toBe("grid");
    expect(parseRosterTab("today", "WAITER")).toBe("grid");
    expect(parseRosterTab("attendance", "WAITER")).toBe("attendance");
    expect(parseRosterTab("nonsense", "ADMIN")).toBe("grid");
    expect(parseRosterTab(undefined, "ADMIN")).toBe("grid");
  });
});
