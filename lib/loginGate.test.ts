import { describe, expect, it } from "vitest";
import { loginGateDestination } from "@/lib/loginGate";

const manager = { role: "MANAGER", functions: [] };
const cashier = { role: "CASHIER", functions: [] };

describe("loginGateDestination", () => {
  it("sends a signed-in member of staff to their role's landing page", () => {
    expect(loginGateDestination(manager, null)).toBe("/admin");
    expect(loginGateDestination(cashier, undefined)).toBe("/admin/today");
    expect(loginGateDestination({ role: "CASHIER", functions: ["ENGINEER"] }, null)).toBe("/admin/maintenance");
  });

  it("follows a return link to a path on this site", () => {
    expect(loginGateDestination(manager, "/admin/spa")).toBe("/admin/spa");
  });

  it("ignores a return link that leaves the site", () => {
    expect(loginGateDestination(manager, "https://evil.example/admin")).toBe("/admin");
    expect(loginGateDestination(cashier, "//evil.example")).toBe("/admin/today");
    expect(loginGateDestination(manager, "javascript:alert(1)")).toBe("/admin");
  });

  it("does not loop back to the login page", () => {
    expect(loginGateDestination(manager, "/login?callbackUrl=%2Fadmin")).toBe("/admin");
  });

  it("shows the form when nobody is signed in as staff (expired token, failed check, guest cookie)", () => {
    expect(loginGateDestination(null, "/admin/spa")).toBeNull();
  });
});
