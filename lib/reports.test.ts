import { describe, expect, it } from "vitest";
import {
  GUEST_LTV_DEFAULT_LIMIT,
  formatBaht,
  formatBahtOrDash,
  formatPercent,
  isRangeInverted,
  parseGuestLtvLimit,
  parseReportRange,
} from "@/lib/reports";

describe("parseReportRange", () => {
  it("keeps a valid range", () => {
    expect(parseReportRange("2026-08-01", "2026-08-31", "2026-09-28")).toEqual({ from: "2026-08-01", to: "2026-08-31" });
  });

  it("falls back to month-to-date when either end is missing or malformed", () => {
    const monthToDate = { from: "2026-09-01", to: "2026-09-28" };
    expect(parseReportRange(undefined, undefined, "2026-09-28")).toEqual(monthToDate);
    expect(parseReportRange("2026-08-01", undefined, "2026-09-28")).toEqual(monthToDate);
    expect(parseReportRange("2026-02-30", "2026-03-01", "2026-09-28")).toEqual(monthToDate);
  });

  it("keeps an inverted range as given", () => {
    const range = parseReportRange("2026-09-10", "2026-09-01", "2026-09-28");
    expect(range).toEqual({ from: "2026-09-10", to: "2026-09-01" });
    expect(isRangeInverted(range)).toBe(true);
  });

  it("allows a single-night range", () => {
    expect(isRangeInverted({ from: "2026-09-01", to: "2026-09-01" })).toBe(false);
  });
});

describe("formatPercent", () => {
  it("shows a null share as a dash, not 0%", () => {
    expect(formatPercent(null)).toBe("—");
    expect(formatPercent("0.00")).toBe("0.00%");
    expect(formatPercent("42.50")).toBe("42.50%");
  });
});

describe("formatBaht", () => {
  it("formats a server decimal string", () => {
    expect(formatBaht("12345.50")).toBe("฿12,345.5");
    expect(formatBaht("0.00")).toBe("฿0");
  });
});

describe("formatBahtOrDash", () => {
  it("shows a null ratio as a dash, not ฿0", () => {
    expect(formatBahtOrDash(null)).toBe("—");
    expect(formatBahtOrDash("0.00")).toBe("฿0");
    expect(formatBahtOrDash("1500.50")).toBe("฿1,500.5");
  });
});

describe("parseGuestLtvLimit", () => {
  it("defaults to the backend's own default of 50", () => {
    expect(GUEST_LTV_DEFAULT_LIMIT).toBe(50);
    expect(parseGuestLtvLimit(undefined)).toBe(50);
  });

  it("keeps an offered limit", () => {
    expect(parseGuestLtvLimit("10")).toBe(10);
    expect(parseGuestLtvLimit("200")).toBe(200);
  });

  it("falls back to the default for anything else", () => {
    expect(parseGuestLtvLimit("0")).toBe(50);
    expect(parseGuestLtvLimit("37")).toBe(50);
    expect(parseGuestLtvLimit("500")).toBe(50);
    expect(parseGuestLtvLimit("abc")).toBe(50);
  });
});
