import { describe, expect, it } from "vitest";
import {
  availabilityTone,
  buildRateCells,
  monthDateKeys,
  parseMonthParam,
  parsePriceInput,
  parseViewParam,
  shiftMonth,
  validatePriceRange,
  weekdayOf,
} from "@/lib/ratesGrid";
import type { AvailabilityDay, AvailabilityUnitDay } from "@/lib/types";

function unit(over: Partial<AvailabilityUnitDay> = {}): AvailabilityUnitDay {
  return { roomUnitId: "u", label: "101", isBlocked: false, isBooked: false, isAvailable: true, bookingId: null, blockReason: null, ...over };
}

function availDay(date: string, over: Partial<AvailabilityDay> = {}): AvailabilityDay {
  return { date, unitCount: 2, blockedCount: 0, bookedCount: 0, availableCount: 2, units: [unit(), unit()], ...over };
}

describe("parseMonthParam", () => {
  it("keeps a well-formed month", () => {
    expect(parseMonthParam("2026-02", "2026-10-03")).toBe("2026-02");
  });
  it("falls back to the hotel's current month for missing or malformed input", () => {
    expect(parseMonthParam(undefined, "2026-10-03")).toBe("2026-10");
    expect(parseMonthParam("2026-13", "2026-10-03")).toBe("2026-10");
    expect(parseMonthParam("2026-1", "2026-10-03")).toBe("2026-10");
    expect(parseMonthParam("2026-10-01", "2026-10-03")).toBe("2026-10");
  });
});

describe("parseViewParam", () => {
  it("defaults to rates", () => {
    expect(parseViewParam(undefined)).toBe("rates");
    expect(parseViewParam("nonsense")).toBe("rates");
    expect(parseViewParam("availability")).toBe("availability");
  });
});

describe("shiftMonth / monthDateKeys", () => {
  it("crosses year boundaries", () => {
    expect(shiftMonth("2026-12", 1)).toBe("2027-01");
    expect(shiftMonth("2026-01", -1)).toBe("2025-12");
  });
  it("lists every day of the month, leap years included", () => {
    expect(monthDateKeys("2028-02")).toHaveLength(29);
    expect(monthDateKeys("2026-02")).toHaveLength(28);
    expect(monthDateKeys("2026-10")[0]).toBe("2026-10-01");
    expect(monthDateKeys("2026-10").at(-1)).toBe("2026-10-31");
  });
  it("weekdayOf is the UTC weekday of the date, not shifted by the local zone", () => {
    expect(weekdayOf("2026-10-03")).toBe(6); // Saturday
    expect(weekdayOf("2026-10-04")).toBe(0);
  });
});

describe("buildRateCells", () => {
  it("takes rooms left from the server's availableCount, not from counting free units", () => {
    // An unassigned booking: bookedCount 1, but no unit marked booked - both units look free.
    const day = availDay("2026-10-01", { bookedCount: 1, availableCount: 1 });
    const [cell] = buildRateCells(["2026-10-01"], [{ date: "2026-10-01", price: 1500, isOverride: true }], [day]);
    expect(cell).toMatchObject({ price: 1500, isOverride: true, available: 1, total: 2 });
  });

  it("keeps a negative remainder as is", () => {
    const [cell] = buildRateCells(["2026-10-01"], null, [availDay("2026-10-01", { availableCount: -1 })]);
    expect(cell.available).toBe(-1);
  });

  it("leaves a side null when its request failed, rather than inventing a value", () => {
    const [cell] = buildRateCells(["2026-10-01"], null, null);
    expect(cell).toMatchObject({ price: null, available: null, total: null, isOverride: false, needsReview: false });
  });

  it("flags a day carrying an unreviewed auto-migrated block", () => {
    const day = availDay("2026-10-01", {
      units: [unit({ isBlocked: true, isAvailable: false, blockReason: "Auto-migrated from legacy block count (3)" }), unit()],
    });
    const [cell] = buildRateCells(["2026-10-01"], null, [day]);
    expect(cell.needsReview).toBe(true);
  });
});

describe("availabilityTone", () => {
  it("distinguishes oversold from an ordinary full night", () => {
    expect(availabilityTone(-1, 2)).toBe("oversold");
    expect(availabilityTone(0, 2)).toBe("soldOut");
    expect(availabilityTone(1, 2)).toBe("partial");
    expect(availabilityTone(2, 2)).toBe("open");
  });
  it("has no tone for a type with no rooms or no data", () => {
    expect(availabilityTone(0, 0)).toBe("none");
    expect(availabilityTone(null, null)).toBe("none");
  });
  it("still flags oversold on a type whose last room was deactivated", () => {
    expect(availabilityTone(-1, 0)).toBe("oversold");
  });
});

describe("parsePriceInput", () => {
  it("accepts positive amounts, with thousands separators", () => {
    expect(parsePriceInput("1500")).toBe(1500);
    expect(parsePriceInput(" 1,500 ")).toBe(1500);
    expect(parsePriceInput("1499.5")).toBe(1499.5);
  });
  it("rejects zero, negatives and junk - the backend requires price > 0", () => {
    expect(parsePriceInput("0")).toBeNull();
    expect(parsePriceInput("-5")).toBeNull();
    expect(parsePriceInput("")).toBeNull();
    expect(parsePriceInput("abc")).toBeNull();
    expect(parsePriceInput("1e3")).toBeNull();
  });
});

describe("validatePriceRange", () => {
  it("allows a single night and rejects an inverted range", () => {
    expect(validatePriceRange("2026-10-01", "2026-10-01")).toBeNull();
    expect(validatePriceRange("2026-10-02", "2026-10-01")).not.toBeNull();
    expect(validatePriceRange("", "2026-10-01")).not.toBeNull();
  });
});
