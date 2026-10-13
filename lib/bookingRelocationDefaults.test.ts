import { describe, expect, it } from "vitest";
import { defaultRelocationDate } from "./bookingRelocationDefaults";

describe("defaultRelocationDate", () => {
  it("is today when today is inside the stay", () => {
    expect(defaultRelocationDate("2026-10-12", "2026-10-10", "2026-10-15")).toBe("2026-10-12");
  });

  it("is the day after check-in for a stay that has not started", () => {
    expect(defaultRelocationDate("2026-10-01", "2026-10-10", "2026-10-15")).toBe("2026-10-11");
    // Today is the check-in day itself: the move can't start before the second night.
    expect(defaultRelocationDate("2026-10-10", "2026-10-10", "2026-10-15")).toBe("2026-10-11");
  });

  it("is the last night for a stay that is nearly over", () => {
    expect(defaultRelocationDate("2026-10-20", "2026-10-10", "2026-10-15")).toBe("2026-10-14");
  });

  it("falls back to check-in for a one-night stay", () => {
    expect(defaultRelocationDate("2026-10-10", "2026-10-10", "2026-10-11")).toBe("2026-10-10");
  });
});
