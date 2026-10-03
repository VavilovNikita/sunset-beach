import { describe, expect, it } from "vitest";
import { overdueDaysFor, overdueLabel } from "@/lib/overstay";

describe("overdueLabel", () => {
  it("says nothing for a guest who isn't overdue", () => {
    expect(overdueLabel(0)).toBeNull();
    expect(overdueLabel(undefined)).toBeNull();
    expect(overdueLabel(null)).toBeNull();
  });

  it("matches the night audit's wording", () => {
    expect(overdueLabel(1)).toBe("1 day overdue");
    expect(overdueLabel(26)).toBe("26 days overdue");
  });
});

describe("overdueDaysFor", () => {
  const checkedIn = { occupancyStatus: "CHECKED_IN", status: "CONFIRMED", checkOut: "2026-09-07" };

  it("counts days since checkOut for a guest still checked in", () => {
    expect(overdueDaysFor(checkedIn, "2026-10-03")).toBe(26);
  });

  it("is zero on the departure day itself - due out, not overdue", () => {
    expect(overdueDaysFor(checkedIn, "2026-09-07")).toBe(0);
  });

  it("is zero once checked out, or for a cancelled booking", () => {
    expect(overdueDaysFor({ ...checkedIn, occupancyStatus: "CHECKED_OUT" }, "2026-10-03")).toBe(0);
    expect(overdueDaysFor({ ...checkedIn, status: "CANCELLED" }, "2026-10-03")).toBe(0);
  });

  it("crosses a month boundary without a timezone shift", () => {
    expect(overdueDaysFor({ ...checkedIn, checkOut: "2026-08-31" }, "2026-09-02")).toBe(2);
  });
});
