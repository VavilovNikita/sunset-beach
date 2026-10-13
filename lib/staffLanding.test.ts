import { describe, expect, it } from "vitest";
import { staffLanding } from "./staffLanding";

describe("staffLanding", () => {
  it("lets a job function win over the role for a waiter or a cashier", () => {
    expect(staffLanding("WAITER", ["ENGINEER"])).toBe("/admin/maintenance");
    expect(staffLanding("CASHIER", ["ENGINEER"])).toBe("/admin/maintenance");
    expect(staffLanding("CASHIER", ["THERAPIST"])).toBe("/admin/spa");
    expect(staffLanding("WAITER", ["THERAPIST"])).toBe("/admin/spa");
  });

  it("puts ENGINEER first when a person holds two functions", () => {
    expect(staffLanding("CASHIER", ["THERAPIST", "ENGINEER"])).toBe("/admin/maintenance");
  });

  it("keeps the role's own page without a function, or with one that has no page of its own", () => {
    expect(staffLanding("WAITER", [])).toBe("/pos");
    expect(staffLanding("CASHIER", undefined)).toBe("/admin/today");
    expect(staffLanding("WAITER", ["HOUSEKEEPER"])).toBe("/pos");
  });

  it("sends a manager or an admin to the dashboard whatever functions they hold", () => {
    expect(staffLanding("MANAGER", ["ENGINEER", "THERAPIST"])).toBe("/admin");
    expect(staffLanding("ADMIN", ["THERAPIST"])).toBe("/admin");
    expect(staffLanding(null, undefined)).toBe("/admin");
  });
});
