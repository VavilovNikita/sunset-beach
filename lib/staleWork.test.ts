import { describe, expect, it } from "vitest";
import { isStale, staleAge, staleShiftNotes, STALE_AFTER_HOURS } from "@/lib/staleWork";
import { LONG_OPEN_HOURS } from "@/lib/posOrders";
import { LONG_OPEN_SHIFT_HOURS } from "@/lib/shiftReconciliation";

const NOW = new Date("2026-10-24T12:00:00Z");

describe("stale work", () => {
  it("shifts and orders share one threshold", () => {
    expect(LONG_OPEN_HOURS).toBe(STALE_AFTER_HOURS);
    expect(LONG_OPEN_SHIFT_HOURS).toBe(STALE_AFTER_HOURS);
  });

  it("is stale from exactly 24 hours", () => {
    expect(isStale("2026-10-23T12:00:00Z", NOW)).toBe(true);
    expect(isStale("2026-10-23T12:00:01Z", NOW)).toBe(false);
    expect(isStale("not a date", NOW)).toBe(false);
  });

  it("words the age in hours then days", () => {
    expect(staleAge("2026-10-23T06:00:00Z", NOW)).toBe("30 h");
    expect(staleAge("2026-09-02T12:00:00Z", NOW)).toBe("52 days");
  });

  it("tells the viewer's own shift from someone else's", () => {
    const notes = staleShiftNotes(
      [
        { id: "a", openedAt: "2026-09-02T12:00:00Z", openedByUserId: "u1", openedByName: "Nok" },
        { id: "b", openedAt: "2026-10-22T12:00:00Z", openedByUserId: "u2", openedByEmail: "x@y.z" },
      ],
      "u1",
      NOW,
    );
    expect(notes.map((n) => [n.id, n.mine, n.who])).toEqual([
      ["a", true, "Nok"],
      ["b", false, "x@y.z"],
    ]);
  });
});
