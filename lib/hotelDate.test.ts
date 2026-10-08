import { describe, expect, it } from "vitest";
import { addDaysToDateKey, hotelDateKey, hotelYearMonth } from "./hotelDate";

// The point of these: the answer is the hotel's (Asia/Bangkok, UTC+7), whatever zone the test
// machine, the server or a manager's laptop is in.
describe("hotel date", () => {
  it("is Bangkok's calendar day, not UTC's and not the machine's", () => {
    expect(hotelDateKey(new Date("2026-10-04T18:30:00Z"))).toBe("2026-10-05");
    expect(hotelDateKey(new Date("2026-10-05T16:59:00Z"))).toBe("2026-10-05");
    expect(hotelDateKey(new Date("2026-10-05T17:00:00Z"))).toBe("2026-10-06");
  });

  it("rolls the month over at Bangkok midnight", () => {
    expect(hotelYearMonth(new Date("2026-09-30T17:30:00Z"))).toEqual({ year: 2026, month: 10 });
    expect(hotelYearMonth(new Date("2026-12-31T20:00:00Z"))).toEqual({ year: 2027, month: 1 });
  });

  it("shifts a date key by whole days without touching a zone", () => {
    expect(addDaysToDateKey("2026-10-01", -7)).toBe("2026-09-24");
    expect(addDaysToDateKey("2026-12-31", 1)).toBe("2027-01-01");
  });
});
