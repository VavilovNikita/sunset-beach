import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { isOutageStatus } from "./backendOutage";
import { UPDATING_HTML, updatingResponse } from "./updatingPage";

describe("updating page", () => {
  it("is a 503 with a retry hint, never cached", () => {
    const res = updatingResponse();
    expect(res.status).toBe(503);
    expect(res.headers.get("Retry-After")).toBe("5");
    expect(res.headers.get("Cache-Control")).toBe("no-store");
  });

  it("nginx serves the same page when the whole app is down", () => {
    expect(readFileSync("nginx/updating.html", "utf8")).toBe(UPDATING_HTML);
  });
});

describe("isOutageStatus", () => {
  it("treats gateway errors as an outage and a real 500 as a bug", () => {
    expect([502, 503, 504].every(isOutageStatus)).toBe(true);
    expect([200, 401, 404, 500].some(isOutageStatus)).toBe(false);
  });
});
