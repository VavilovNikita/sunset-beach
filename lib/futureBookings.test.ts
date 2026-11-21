import { describe, expect, it } from "vitest";
import {
  defaultFutureRange,
  futureQuery,
  futureStatusesParam,
  isFutureRangeInverted,
  parseFutureRange,
  parseFutureStatuses,
  toggleFutureStatus,
} from "@/lib/futureBookings";

describe("future bookings statuses", () => {
  it("defaults to all three and ignores anything unknown", () => {
    expect(parseFutureStatuses(undefined)).toEqual(["NEW", "CONFIRMED", "PAID"]);
    expect(parseFutureStatuses("CANCELLED,whatever")).toEqual(["NEW", "CONFIRMED", "PAID"]);
  });
  it("reads a comma list and repeated values, in the server's order", () => {
    expect(parseFutureStatuses("PAID,NEW")).toEqual(["NEW", "PAID"]);
    expect(parseFutureStatuses(["CONFIRMED", "PAID"])).toEqual(["CONFIRMED", "PAID"]);
  });
  it("never lets the last status be switched off", () => {
    expect(toggleFutureStatus(["NEW", "CONFIRMED", "PAID"], "PAID")).toEqual(["NEW", "CONFIRMED"]);
    expect(toggleFutureStatus(["CONFIRMED"], "CONFIRMED")).toEqual(["CONFIRMED"]);
    expect(toggleFutureStatus(["CONFIRMED"], "NEW")).toEqual(["NEW", "CONFIRMED"]);
  });
  it("puts a status list in the address only when it narrows", () => {
    expect(futureStatusesParam(["NEW", "CONFIRMED", "PAID"])).toBeUndefined();
    expect(futureStatusesParam(["NEW", "PAID"])).toBe("NEW,PAID");
  });
});

describe("future bookings range", () => {
  it("starts today and runs 90 days", () => {
    expect(defaultFutureRange("2026-11-21")).toEqual({ from: "2026-11-21", to: "2027-02-19" });
  });
  it("keeps a chosen range and refuses garbage", () => {
    expect(parseFutureRange("2026-12-01", "2026-12-31", "2026-11-21")).toEqual({ from: "2026-12-01", to: "2026-12-31" });
    expect(parseFutureRange("nope", undefined, "2026-11-21")).toEqual(defaultFutureRange("2026-11-21"));
    expect(parseFutureRange("2026-12-01", undefined, "2026-11-21").to).toBe("2027-03-01");
  });
  it("sees an inverted range", () => {
    expect(isFutureRangeInverted({ from: "2026-12-02", to: "2026-12-01" })).toBe(true);
  });
});

describe("futureQuery", () => {
  it("sends the dates, and the statuses only when narrowed", () => {
    expect(futureQuery({ from: "2026-12-01", to: "2026-12-31" }, ["NEW", "CONFIRMED", "PAID"])).toBe("from=2026-12-01&to=2026-12-31");
    expect(futureQuery({ from: "2026-12-01", to: "2026-12-31" }, ["PAID", "NEW"])).toBe("from=2026-12-01&to=2026-12-31&status=NEW&status=PAID");
  });
});
