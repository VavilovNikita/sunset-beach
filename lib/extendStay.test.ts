import { describe, expect, it } from "vitest";
import { extendedCheckOut } from "@/lib/extendStay";

describe("extendedCheckOut", () => {
  it("is tomorrow in the hotel's calendar", () => {
    // 20:00 UTC on the 24th is already 03:00 on the 25th in Bangkok: tomorrow is the 26th.
    expect(extendedCheckOut(new Date("2026-10-24T20:00:00Z"))).toBe("2026-10-26");
    expect(extendedCheckOut(new Date("2026-10-24T05:00:00Z"))).toBe("2026-10-25");
  });
  it("crosses a month end", () => {
    expect(extendedCheckOut(new Date("2026-10-31T05:00:00Z"))).toBe("2026-11-01");
  });
});
