import { describe, expect, it } from "vitest";
import { formatSentAt, parseWholeNumberInRange } from "@/lib/lifecycleEmails";

describe("formatSentAt", () => {
  it("shows hotel-local time regardless of the offset it arrives with", () => {
    expect(formatSentAt("2031-03-10T10:00:00+07:00")).toBe("10 Mar 2031, 10:00");
    expect(formatSentAt("2031-03-10T03:00:00Z")).toBe("10 Mar 2031, 10:00");
  });

  it("rolls onto the hotel's calendar date, not UTC's", () => {
    expect(formatSentAt("2031-03-09T18:30:00Z")).toBe("10 Mar 2031, 01:30");
  });

  it("returns an unparseable value as-is rather than 'Invalid Date'", () => {
    expect(formatSentAt("not-a-date")).toBe("not-a-date");
  });
});

describe("parseWholeNumberInRange", () => {
  it("accepts whole numbers inside the range, trimmed", () => {
    expect(parseWholeNumberInRange(" 3 ", 0, 60)).toBe(3);
    expect(parseWholeNumberInRange("0", 0, 60)).toBe(0);
    expect(parseWholeNumberInRange("60", 0, 60)).toBe(60);
  });

  it("rejects blanks, decimals, negatives and out-of-range values", () => {
    for (const text of ["", " ", "1.5", "-1", "61", "abc", "1e2"]) {
      expect(parseWholeNumberInRange(text, 0, 60)).toBeNull();
    }
    expect(parseWholeNumberInRange("0", 1, 120)).toBeNull();
  });
});
