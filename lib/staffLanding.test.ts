import { describe, expect, it } from "vitest";
import { safeCallbackUrl, staffHomeLink, staffLanding } from "./staffLanding";

describe("staffHomeLink", () => {
  it("names the button by the page the role starts on", () => {
    expect(staffHomeLink("WAITER", [])).toEqual({ href: "/pos", label: "Go to POS" });
    expect(staffHomeLink("CASHIER", [])).toEqual({ href: "/admin/today", label: "Go to Today" });
    expect(staffHomeLink("MANAGER", [])).toEqual({ href: "/admin", label: "Go to Dashboard" });
    expect(staffHomeLink("WAITER", ["ENGINEER"])).toEqual({ href: "/admin/maintenance", label: "Go to Maintenance" });
  });

  it("has a label for every landing page", () => {
    for (const role of ["WAITER", "CASHIER", "MANAGER", "ADMIN"]) {
      for (const functions of [[], ["ENGINEER"], ["THERAPIST"], ["HR"], ["HOUSEKEEPER"]]) {
        expect(staffHomeLink(role, functions).label).not.toBe("Go to the start page");
      }
    }
  });
});

describe("staffLanding", () => {
  it("lets a job function win over the role for a waiter or a cashier", () => {
    expect(staffLanding("WAITER", ["ENGINEER"])).toBe("/admin/maintenance");
    expect(staffLanding("CASHIER", ["ENGINEER"])).toBe("/admin/maintenance");
    expect(staffLanding("CASHIER", ["THERAPIST"])).toBe("/admin/spa");
    expect(staffLanding("WAITER", ["THERAPIST"])).toBe("/admin/spa");
  });

  it("lands an HR director on the shift requests, and ENGINEER or THERAPIST still come first", () => {
    expect(staffLanding("WAITER", ["HR"])).toBe("/admin/shift-requests");
    expect(staffLanding("CASHIER", ["HR"])).toBe("/admin/shift-requests");
    expect(staffLanding("CASHIER", ["HR", "THERAPIST"])).toBe("/admin/spa");
    expect(staffLanding("MANAGER", ["HR"])).toBe("/admin");
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

describe("safeCallbackUrl", () => {
  it("keeps a path on this site", () => {
    expect(safeCallbackUrl("/admin/bookings/abc?tab=folio")).toBe("/admin/bookings/abc?tab=folio");
  });

  it("drops anything that would leave the site", () => {
    for (const url of ["https://evil.example/admin", "//evil.example/admin", "/\\evil.example", "javascript:alert(1)", "admin", ""]) {
      expect(safeCallbackUrl(url)).toBeNull();
    }
    expect(safeCallbackUrl(null)).toBeNull();
  });
});
