import { describe, expect, it } from "vitest";
import { forwardedIpHeaders } from "./clientIp";

describe("forwardedIpHeaders", () => {
  it("forwards the nginx-set X-Real-IP as X-Forwarded-For", () => {
    expect(forwardedIpHeaders(new Headers({ "x-real-ip": "203.0.113.7" }))).toEqual({ "X-Forwarded-For": "203.0.113.7" });
  });

  it("never forwards a visitor-written X-Forwarded-For", () => {
    expect(forwardedIpHeaders(new Headers({ "x-forwarded-for": "1.2.3.4" }))).toEqual({});
    expect(forwardedIpHeaders(new Headers({ "x-forwarded-for": "1.2.3.4", "x-real-ip": "203.0.113.7" }))).toEqual({
      "X-Forwarded-For": "203.0.113.7",
    });
  });

  it("forwards nothing when there is no proxy in front (local dev)", () => {
    expect(forwardedIpHeaders(new Headers())).toEqual({});
    expect(forwardedIpHeaders(new Headers({ "x-real-ip": "  " }))).toEqual({});
  });
});
