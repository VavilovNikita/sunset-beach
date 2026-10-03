import { describe, expect, it } from "vitest";
import {
  DEFAULT_BOOKING_LIST_PARAMS,
  bookingListHref,
  bookingSearchApiPath,
  isArrivalPassed,
  pageSpan,
  parseBookingListParams,
  sortedBy,
} from "@/lib/bookingList";

describe("parseBookingListParams", () => {
  it("defaults to latest check-in first, first page, no filters", () => {
    expect(parseBookingListParams({})).toEqual(DEFAULT_BOOKING_LIST_PARAMS);
  });

  it("drops anything malformed instead of sending it to the API", () => {
    expect(parseBookingListParams({ from: "2026-13-01", status: "LOST", sort: "price", dir: "up", page: "-2" })).toEqual(
      DEFAULT_BOOKING_LIST_PARAMS
    );
  });

  it("round-trips through the URL", () => {
    const params = { ...DEFAULT_BOOKING_LIST_PARAMS, q: "smith", status: "NEW" as const, sort: "GUEST_NAME" as const, dir: "ASC" as const, page: 2 };
    const href = bookingListHref(params);
    const parsed = parseBookingListParams(Object.fromEntries(new URLSearchParams(href.split("?")[1])));
    expect(parsed).toEqual(params);
  });

  it("keeps a plain list's URL plain", () => {
    expect(bookingListHref(DEFAULT_BOOKING_LIST_PARAMS)).toBe("/admin/bookings");
  });
});

describe("sortedBy", () => {
  it("flips direction when the same column is clicked again", () => {
    expect(sortedBy(DEFAULT_BOOKING_LIST_PARAMS, "CHECK_IN")).toMatchObject({ sort: "CHECK_IN", dir: "ASC" });
  });

  it("starts names A→Z and amounts largest first, back on page one", () => {
    const onPage3 = { ...DEFAULT_BOOKING_LIST_PARAMS, page: 3 };
    expect(sortedBy(onPage3, "GUEST_NAME")).toMatchObject({ sort: "GUEST_NAME", dir: "ASC", page: 0 });
    expect(sortedBy(onPage3, "TOTAL_PRICE")).toMatchObject({ sort: "TOTAL_PRICE", dir: "DESC", page: 0 });
  });
});

describe("bookingSearchApiPath", () => {
  it("asks the server for exactly this page, sorted", () => {
    expect(bookingSearchApiPath({ ...DEFAULT_BOOKING_LIST_PARAMS, q: "ann", page: 1 })).toBe(
      "/bookings/search?q=ann&sort=CHECK_IN&direction=DESC&page=1&pageSize=50"
    );
  });
});

describe("pageSpan", () => {
  it("numbers the rows on a page", () => {
    expect(pageSpan(0, 50, 120)).toEqual({ first: 1, last: 50, pageCount: 3 });
    expect(pageSpan(2, 50, 120)).toEqual({ first: 101, last: 120, pageCount: 3 });
  });

  it("is empty but still one page when nothing matches", () => {
    expect(pageSpan(0, 50, 0)).toEqual({ first: 0, last: 0, pageCount: 1 });
  });
});

describe("isArrivalPassed", () => {
  const today = "2026-10-03";

  it("flags a live booking whose guest never arrived", () => {
    expect(isArrivalPassed({ status: "NEW", occupancyStatus: "EXPECTED", checkIn: "2026-08-02" }, today)).toBe(true);
    expect(isArrivalPassed({ status: "PAID", occupancyStatus: "EXPECTED", checkIn: "2026-10-02" }, today)).toBe(true);
  });

  it("doesn't flag today's arrivals, guests who came, no-shows already marked, or cancellations", () => {
    expect(isArrivalPassed({ status: "NEW", occupancyStatus: "EXPECTED", checkIn: today }, today)).toBe(false);
    expect(isArrivalPassed({ status: "CONFIRMED", occupancyStatus: "CHECKED_OUT", checkIn: "2026-08-02" }, today)).toBe(false);
    expect(isArrivalPassed({ status: "CONFIRMED", occupancyStatus: "NO_SHOW", checkIn: "2026-08-02" }, today)).toBe(false);
    expect(isArrivalPassed({ status: "CANCELLED", occupancyStatus: "EXPECTED", checkIn: "2026-08-02" }, today)).toBe(false);
  });
});
