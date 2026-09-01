import { describe, expect, it } from "vitest";
import {
  parseDateKey,
  dateOnlyUTC,
  toDateKey,
  addDaysUTC,
  daysBetweenUTC,
  getNights,
  startOfMonthUTC,
  endOfMonthUTC,
  addMonthsUTC,
} from "./bookings";

describe("parseDateKey", () => {
  it("parses a valid YYYY-MM-DD key as UTC midnight", () => {
    const d = parseDateKey("2026-03-05");
    expect(d.getUTCFullYear()).toBe(2026);
    expect(d.getUTCMonth()).toBe(2); // 0-indexed
    expect(d.getUTCDate()).toBe(5);
    expect(d.getUTCHours()).toBe(0);
  });

  // The historical bug: an Invalid Date used to sail through silently, and every later >=/<
  // comparison against it resolved to false, quietly zeroing dashboard revenue/occupancy
  // instead of erroring. Loud failure is the fix - lock it in.
  it.each([
    ["", "empty string"],
    ["2026/03/05", "wrong separators"],
    ["03-05-2026", "wrong field order"],
    ["2026-3-5", "unpadded"],
    ["2026-03-05T00:00:00.000Z", "datetime suffix"],
    ["not-a-date", "garbage"],
  ])("throws on malformed input %j (%s)", (input) => {
    expect(() => parseDateKey(input)).toThrow();
  });

  it.each([
    ["2026-13-01", "month 13"],
    ["2026-00-01", "month 0"],
    ["2026-02-30", "Feb 30 (doesn't exist)"],
    ["2026-02-29", "Feb 29 in a non-leap year (2026)"],
    ["2026-04-31", "April 31 (April has 30 days)"],
  ])("throws on a shape-valid but calendar-invalid date %j (%s)", (input) => {
    // Date.UTC silently rolls these over into a different, valid-looking date instead of
    // failing on its own - this is the specific case parseDateKey has to catch by hand.
    expect(() => parseDateKey(input)).toThrow();
  });

  it("accepts Feb 29 in an actual leap year", () => {
    const d = parseDateKey("2028-02-29");
    expect(d.getUTCMonth()).toBe(1);
    expect(d.getUTCDate()).toBe(29);
  });
});

describe("dateOnlyUTC", () => {
  it("accepts a Date object and truncates time-of-day to UTC midnight", () => {
    const withTime = new Date(Date.UTC(2026, 5, 15, 13, 45, 30));
    const truncated = dateOnlyUTC(withTime);
    expect(toDateKey(truncated)).toBe("2026-06-15");
    expect(truncated.getUTCHours()).toBe(0);
  });

  it("accepts a bare YYYY-MM-DD string", () => {
    expect(toDateKey(dateOnlyUTC("2026-06-15"))).toBe("2026-06-15");
  });

  it("accepts a string with a datetime suffix by slicing to the date part", () => {
    expect(toDateKey(dateOnlyUTC("2026-06-15T00:00:00.000Z"))).toBe("2026-06-15");
  });
});

describe("toDateKey / parseDateKey round-trip", () => {
  it("round-trips a date through both directions", () => {
    expect(toDateKey(parseDateKey("2026-12-31"))).toBe("2026-12-31");
  });
});

describe("addDaysUTC", () => {
  it("adds days within a month", () => {
    expect(toDateKey(addDaysUTC(parseDateKey("2026-06-15"), 5))).toBe("2026-06-20");
  });

  it("rolls over a month boundary", () => {
    expect(toDateKey(addDaysUTC(parseDateKey("2026-01-31"), 1))).toBe("2026-02-01");
  });

  it("rolls over a year boundary", () => {
    expect(toDateKey(addDaysUTC(parseDateKey("2026-12-31"), 1))).toBe("2027-01-01");
  });

  it("supports negative days", () => {
    expect(toDateKey(addDaysUTC(parseDateKey("2026-03-01"), -1))).toBe("2026-02-28");
  });
});

describe("daysBetweenUTC", () => {
  it("is zero for the same date", () => {
    const d = parseDateKey("2026-06-15");
    expect(daysBetweenUTC(d, d)).toBe(0);
  });

  it("is positive when `to` is later", () => {
    expect(daysBetweenUTC(parseDateKey("2026-06-15"), parseDateKey("2026-06-20"))).toBe(5);
  });

  it("is negative when `to` is earlier", () => {
    expect(daysBetweenUTC(parseDateKey("2026-06-20"), parseDateKey("2026-06-15"))).toBe(-5);
  });

  it("spans a month boundary correctly", () => {
    expect(daysBetweenUTC(parseDateKey("2026-01-25"), parseDateKey("2026-02-05"))).toBe(11);
  });
});

describe("getNights", () => {
  it("returns one night per day in [checkIn, checkOut)", () => {
    const nights = getNights("2026-06-15", "2026-06-18");
    expect(nights.map(toDateKey)).toEqual(["2026-06-15", "2026-06-16", "2026-06-17"]);
  });

  // The checkout day itself is not a night - a guest leaving on the 18th doesn't pay for the
  // 18th. This is the exact half-open-interval rule that shows up again in calendarLayout.ts.
  it("excludes the checkout day itself", () => {
    const nights = getNights("2026-06-15", "2026-06-16");
    expect(nights).toHaveLength(1);
    expect(toDateKey(nights[0])).toBe("2026-06-15");
  });

  it("is empty for a same-day (zero-night) range", () => {
    expect(getNights("2026-06-15", "2026-06-15")).toEqual([]);
  });

  // Without the Math.max(nightCount, 0) guard in getNights, Array.from({length: -N}) throws a
  // RangeError - a reversed range must degrade to "no nights", not crash the caller.
  it("is empty (not a crash) for a reversed range", () => {
    expect(() => getNights("2026-06-18", "2026-06-15")).not.toThrow();
    expect(getNights("2026-06-18", "2026-06-15")).toEqual([]);
  });

  it("spans a month boundary", () => {
    const nights = getNights("2026-01-30", "2026-02-02");
    expect(nights.map(toDateKey)).toEqual(["2026-01-30", "2026-01-31", "2026-02-01"]);
  });

  it("accepts Date objects as well as strings", () => {
    const nights = getNights(parseDateKey("2026-06-15"), parseDateKey("2026-06-17"));
    expect(nights.map(toDateKey)).toEqual(["2026-06-15", "2026-06-16"]);
  });
});

describe("startOfMonthUTC / endOfMonthUTC", () => {
  it("finds the first and last day of a mid-month date", () => {
    const d = parseDateKey("2026-06-15");
    expect(toDateKey(startOfMonthUTC(d))).toBe("2026-06-01");
    expect(toDateKey(endOfMonthUTC(d))).toBe("2026-06-30");
  });

  it("handles December correctly (year does not roll forward)", () => {
    const d = parseDateKey("2026-12-10");
    expect(toDateKey(startOfMonthUTC(d))).toBe("2026-12-01");
    expect(toDateKey(endOfMonthUTC(d))).toBe("2026-12-31");
  });

  it("gives February 28 in a non-leap year", () => {
    expect(toDateKey(endOfMonthUTC(parseDateKey("2026-02-10")))).toBe("2026-02-28");
  });

  it("gives February 29 in a leap year", () => {
    expect(toDateKey(endOfMonthUTC(parseDateKey("2028-02-10")))).toBe("2028-02-29");
  });
});

describe("addMonthsUTC", () => {
  it("adds months within the same year", () => {
    expect(toDateKey(addMonthsUTC(parseDateKey("2026-03-15"), 2))).toBe("2026-05-15");
  });

  it("rolls over a year boundary", () => {
    expect(toDateKey(addMonthsUTC(parseDateKey("2026-11-15"), 3))).toBe("2027-02-15");
  });

  it("supports negative months", () => {
    expect(toDateKey(addMonthsUTC(parseDateKey("2026-02-15"), -3))).toBe("2025-11-15");
  });

  // Documented, not "fixed": Date.UTC normalizes an out-of-range day by rolling into the
  // following month rather than clamping - Jan 31 + 1 month lands on Mar 3 (Feb 2026 has 28
  // days), not Feb 28. Any caller that needs "end of target month" instead must go through
  // endOfMonthUTC explicitly, not assume addMonthsUTC clamps for it.
  it("rolls a day-of-month overflow into the following month rather than clamping", () => {
    expect(toDateKey(addMonthsUTC(parseDateKey("2026-01-31"), 1))).toBe("2026-03-03");
  });
});
