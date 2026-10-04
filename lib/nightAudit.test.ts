import { describe, expect, it } from "vitest";
import { describeOverdue, describeUnpaidNights, formatClosedAt, parseNightAuditDateParam } from "@/lib/nightAudit";

describe("parseNightAuditDateParam", () => {
  it("keeps a valid date", () => {
    expect(parseNightAuditDateParam("2026-09-27")).toBe("2026-09-27");
  });

  it("treats a missing, malformed or impossible date as absent", () => {
    expect(parseNightAuditDateParam(undefined)).toBeNull();
    expect(parseNightAuditDateParam("")).toBeNull();
    expect(parseNightAuditDateParam("27/09/2026")).toBeNull();
    expect(parseNightAuditDateParam("2026-02-30")).toBeNull();
  });
});

describe("describeOverdue", () => {
  it("counts whole days between the due date and the reviewed date", () => {
    expect(describeOverdue("2026-09-27", "2026-09-27")).toBe("Due today");
    expect(describeOverdue("2026-09-26", "2026-09-27")).toBe("1 day overdue");
    expect(describeOverdue("2026-09-20", "2026-09-27")).toBe("7 days overdue");
  });

  it("crosses a month boundary correctly", () => {
    expect(describeOverdue("2026-08-31", "2026-09-02")).toBe("2 days overdue");
  });
});

describe("describeUnpaidNights", () => {
  it("says nothing when no night is unpaid", () => {
    expect(describeUnpaidNights(0)).toBeNull();
  });

  it("counts the nights the server reports", () => {
    expect(describeUnpaidNights(1)).toBe("Staying unpaid · 1 night");
    expect(describeUnpaidNights(28)).toBe("Staying unpaid · 28 nights");
  });
});

describe("formatClosedAt", () => {
  it("shows hotel-local time, not UTC", () => {
    // 18:30 UTC on the 27th is 01:30 on the 28th in Bangkok.
    expect(formatClosedAt("2026-09-27T18:30:00Z")).toBe("28 Sep 2026, 01:30");
  });

  it("returns the raw value for something unparseable", () => {
    expect(formatClosedAt("not a date")).toBe("not a date");
  });
});
