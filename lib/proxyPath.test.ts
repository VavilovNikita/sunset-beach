import { describe, expect, it } from "vitest";
import { proxyPath } from "./proxyPath";

describe("proxyPath", () => {
  it("joins ordinary segments", () => {
    expect(proxyPath(["bookings", "abc-123", "folio"])).toBe("bookings/abc-123/folio");
  });

  it("refuses a decoded segment that would climb out of the prefix", () => {
    expect(proxyPath(["../../bookings/x/folio"])).toBeNull();
    expect(proxyPath(["me", ".."])).toBeNull();
    expect(proxyPath(["."])).toBeNull();
    expect(proxyPath(["a\\..\\b"])).toBeNull();
    expect(proxyPath(["public", "rooms", ""])).toBeNull();
  });

  it("encodes what remains, so a query or fragment can't be smuggled in a segment", () => {
    expect(proxyPath(["rooms", "a?x=1#y"])).toBe("rooms/a%3Fx%3D1%23y");
  });
});
