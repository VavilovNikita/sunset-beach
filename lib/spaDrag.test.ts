import { describe, expect, it } from "vitest";
import { spaDragBlock, spaDropMessage } from "./spaDrag";

describe("spaDragBlock", () => {
  it("lets a booked appointment be picked up while the day still has a slot ahead", () => {
    expect(spaDragBlock({ status: "BOOKED", guestName: "Anna" }, false)).toBeNull();
  });

  it("holds a booked appointment on a day with no slot left, and says what to do", () => {
    expect(spaDragBlock({ status: "BOOKED", guestName: "Anna" }, true)).toContain("no slot of this day is still ahead");
  });

  it("says why anything else cannot move", () => {
    expect(spaDragBlock({ status: "COMPLETED", guestName: "Anna" }, false)).toBe("Anna's appointment is completed - it can't be moved.");
    expect(spaDragBlock({ status: "CANCELLED", guestName: "Anna" }, true)).toContain("cancelled");
    expect(spaDragBlock({ status: "NO_SHOW", guestName: "Anna" }, false)).toContain("no-show");
  });
});

describe("spaDropMessage", () => {
  it("always says that nothing was changed and why", () => {
    for (const miss of [
      { kind: "outside" } as const,
      { kind: "interrupted" } as const,
      { kind: "occupied", otherGuestName: "Boris" } as const,
      { kind: "swap-missed", otherGuestName: "Boris" } as const,
    ]) {
      expect(spaDropMessage(miss, "Anna"), miss.kind).toMatch(/^Nothing was changed: Anna/);
    }
    expect(spaDropMessage({ kind: "past", startTime: "09:00" }, "Anna")).toContain("09:00 has already passed");
  });
});
