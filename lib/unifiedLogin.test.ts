import { describe, expect, it } from "vitest";
import { decideAfterGuestLogin, decideAfterStaffLogin } from "./unifiedLogin";

describe("decideAfterStaffLogin", () => {
  it("valid staff creds redirect to /admin", () => {
    expect(decideAfterStaffLogin(true, 200, { token: "t", role: "MANAGER" })).toEqual({ action: "redirect-admin" });
  });

  it("a plain wrong-credentials 401 is the only case that falls through to guest login", () => {
    expect(decideAfterStaffLogin(false, 401, { error: "Invalid email or password" })).toEqual({ action: "try-guest" });
  });

  it("a 429 (rate-limited) stops here with a rate-limit message, never try-guest", () => {
    const outcome = decideAfterStaffLogin(false, 429, { error: "Too many failed login attempts. Try again later." });
    expect(outcome.action).toBe("error");
    expect(outcome).not.toEqual({ action: "try-guest" });
    if (outcome.action === "error") {
      expect(outcome.message).toBe("Too many failed login attempts. Try again later.");
    }
  });

  it("a 5xx / network-shaped failure stops here with a generic operational message, never try-guest", () => {
    const outcome = decideAfterStaffLogin(false, 502, null);
    expect(outcome).toEqual({ action: "error", message: "Something went wrong. Please try again." });
  });

  it("a 400 (malformed request) stops here too, never try-guest", () => {
    const outcome = decideAfterStaffLogin(false, 400, { error: "Email and password are required" });
    expect(outcome).toEqual({ action: "error", message: "Email and password are required" });
  });
});

describe("decideAfterGuestLogin", () => {
  it("valid guest creds redirect to /guest/account", () => {
    expect(decideAfterGuestLogin(true, 200, { token: "t" })).toEqual({ action: "redirect-guest" });
  });

  it("a 403 surfaces the guest system's own unverified-email message unchanged", () => {
    const body = { error: "Please verify your email before logging in." };
    expect(decideAfterGuestLogin(false, 403, body)).toEqual({
      action: "unverified",
      message: "Please verify your email before logging in.",
    });
  });

  it("a 401 (wrong password, or no account in either system) is always the same single generic message", () => {
    const wrongPassword = decideAfterGuestLogin(false, 401, { error: "Invalid email or password" });
    const noAccountAtAll = decideAfterGuestLogin(false, 401, { error: "Invalid email or password" });
    expect(wrongPassword).toEqual({ action: "error", message: "Invalid email or password." });
    // Same outcome regardless of the backend body's own wording - the message is hardcoded here,
    // not derived from the response, so it can never accidentally leak a hint the 401 case itself
    // doesn't carry (see this module's own comment on why 401 is deliberately not extractApiError'd).
    expect(noAccountAtAll).toEqual(wrongPassword);
  });

  it("a non-credential failure (429/5xx) gets its own generic message, not the credentials one", () => {
    const outcome = decideAfterGuestLogin(false, 500, null);
    expect(outcome).toEqual({ action: "error", message: "Something went wrong. Please try again." });
  });
});
