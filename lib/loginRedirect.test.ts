import { describe, expect, it } from "vitest";
import { loginHref, safeCallbackUrl } from "@/lib/loginRedirect";

describe("safeCallbackUrl", () => {
  it("keeps a path inside the site", () => {
    expect(safeCallbackUrl("/admin/bookings?x=1")).toBe("/admin/bookings?x=1");
    expect(safeCallbackUrl("/pos")).toBe("/pos");
  });
  it("refuses anything that leaves the site or loops", () => {
    for (const bad of ["https://evil.example", "//evil.example", "/\\evil", "javascript:alert(1)", "/login", "/admin/login", "", null, undefined]) {
      expect(safeCallbackUrl(bad as string | null | undefined)).toBeNull();
    }
  });
});

describe("loginHref", () => {
  it("carries a safe deep link and drops an unsafe one", () => {
    expect(loginHref("/admin/spa")).toBe("/login?callbackUrl=%2Fadmin%2Fspa");
    expect(loginHref("//evil")).toBe("/login");
    expect(loginHref()).toBe("/login");
  });
});
