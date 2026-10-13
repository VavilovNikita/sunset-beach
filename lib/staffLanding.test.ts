import { describe, expect, it } from "vitest";
import { staffLanding } from "./staffLanding";

describe("staffLanding", () => {
  it("keeps a role's own start page ahead of a function", () => {
    expect(staffLanding("WAITER", ["ENGINEER"])).toBe("/pos");
    expect(staffLanding("CASHIER", ["THERAPIST"])).toBe("/admin/today");
  });

  it("sends a manager who is an engineer to the maintenance tasks, and a therapist to the spa schedule", () => {
    expect(staffLanding("MANAGER", ["ENGINEER"])).toBe("/admin/maintenance");
    expect(staffLanding("ADMIN", ["THERAPIST"])).toBe("/admin/spa");
  });

  it("falls back to the dashboard without a function, or with one that has no page of its own", () => {
    expect(staffLanding("MANAGER", [])).toBe("/admin");
    expect(staffLanding("ADMIN", ["HOUSEKEEPER"])).toBe("/admin");
    expect(staffLanding(null, undefined)).toBe("/admin");
  });
});
