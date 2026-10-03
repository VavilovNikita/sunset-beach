import { describe, expect, it } from "vitest";
import { formatDate, formatDateRange, formatTimestamp, formatTimestampDate, formatTimestampTime } from "@/lib/formatDate";

describe("formatDate", () => {
  it("shows a stay date as day, short month, year without shifting the day", () => {
    expect(formatDate("2026-10-05")).toBe("5 Oct 2026");
    expect(formatDate("2027-01-01")).toBe("1 Jan 2027");
  });

  it("ignores a stray time suffix rather than shifting the day", () => {
    expect(formatDate("2026-10-05T00:00:00.000Z")).toBe("5 Oct 2026");
  });

  it("returns something unparseable as-is", () => {
    expect(formatDate("soon")).toBe("soon");
  });
});

describe("formatDateRange", () => {
  it("names the year once within one year", () => {
    expect(formatDateRange("2026-10-03", "2026-10-05")).toBe("3 Oct → 5 Oct 2026");
  });

  it("names both years across a new year", () => {
    expect(formatDateRange("2026-12-30", "2027-01-02")).toBe("30 Dec 2026 → 2 Jan 2027");
  });
});

describe("formatTimestamp", () => {
  it("shows the hotel's wall-clock time, not UTC", () => {
    // 18:30 UTC on 2 Oct is 01:30 on 3 Oct in Bangkok.
    expect(formatTimestamp("2026-10-02T18:30:00Z")).toBe("3 Oct 2026, 01:30");
  });

  it("reads any offset the server sends", () => {
    expect(formatTimestamp("2026-10-03T09:15:00+07:00")).toBe("3 Oct 2026, 09:15");
  });

  it("returns something unparseable as-is", () => {
    expect(formatTimestamp("not a date")).toBe("not a date");
  });
});

describe("formatTimestampDate / formatTimestampTime", () => {
  it("take the hotel-local day and time of an instant", () => {
    expect(formatTimestampDate("2026-10-02T18:30:00Z")).toBe("3 Oct 2026");
    expect(formatTimestampTime("2026-10-02T18:30:00Z")).toBe("01:30");
  });
});

describe("month labels", () => {
  it("writes September as Sep, like every other three-letter month", () => {
    expect(formatDate("2026-09-04")).toBe("4 Sep 2026");
  });

  it("writes midnight as 00:00, not 24:00", () => {
    expect(formatTimestamp("2026-10-02T17:00:00Z")).toBe("3 Oct 2026, 00:00");
  });
});
