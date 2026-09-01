import { describe, expect, it } from "vitest";
import { getNightsAndMonths, mergeQuote } from "./quote";
import { toDateKey } from "./bookings";
import type { PricingResponse, PublicAvailabilityResponse } from "./types";

function pricing(basePrice: number, days: { date: string; price: number }[]): PricingResponse {
  return { basePrice, days: days.map((d) => ({ ...d, isOverride: false })) };
}

function availability(days: { date: string; isBlocked: boolean }[]): PublicAvailabilityResponse {
  return { days };
}

describe("getNightsAndMonths", () => {
  it("returns the nights and the single month they fall in", () => {
    const { nights, months } = getNightsAndMonths("2026-06-10", "2026-06-13");
    expect(nights.map(toDateKey)).toEqual(["2026-06-10", "2026-06-11", "2026-06-12"]);
    expect(months).toEqual(["2026-06"]);
  });

  it("dedupes and lists both months when a stay spans a month boundary", () => {
    const { months } = getNightsAndMonths("2026-06-29", "2026-07-02");
    expect(months).toEqual(["2026-06", "2026-07"]);
  });

  it("is empty for a zero-night (same-day) range", () => {
    const { nights, months } = getNightsAndMonths("2026-06-10", "2026-06-10");
    expect(nights).toEqual([]);
    expect(months).toEqual([]);
  });
});

describe("mergeQuote", () => {
  it("is unavailable with a null total for zero nights", () => {
    expect(mergeQuote([], [], [])).toEqual({ available: false, totalPrice: null });
  });

  it("sums the price of every night from the matching month's pricing data", () => {
    const { nights } = getNightsAndMonths("2026-06-10", "2026-06-13");
    const result = mergeQuote(
      nights,
      [pricing(1000, [
        { date: "2026-06-10", price: 1000 },
        { date: "2026-06-11", price: 1200 },
        { date: "2026-06-12", price: 1000 },
      ])],
      []
    );
    expect(result.available).toBe(true);
    expect(result.totalPrice).toBe(3200);
  });

  it("sums across two months for a stay spanning a month boundary", () => {
    const { nights } = getNightsAndMonths("2026-06-29", "2026-07-02");
    const result = mergeQuote(
      nights,
      [
        pricing(1000, [
          { date: "2026-06-29", price: 1000 },
          { date: "2026-06-30", price: 1000 },
        ]),
        pricing(1000, [{ date: "2026-07-01", price: 1500 }]),
      ],
      []
    );
    expect(result.totalPrice).toBe(3500);
  });

  it("is unavailable when any night in the range is blocked", () => {
    const { nights } = getNightsAndMonths("2026-06-10", "2026-06-13");
    const result = mergeQuote(
      nights,
      [pricing(1000, [
        { date: "2026-06-10", price: 1000 },
        { date: "2026-06-11", price: 1000 },
        { date: "2026-06-12", price: 1000 },
      ])],
      [availability([{ date: "2026-06-11", isBlocked: true }])]
    );
    expect(result.available).toBe(false);
  });

  it("still totals the price even when unavailable (not silently zeroed)", () => {
    const { nights } = getNightsAndMonths("2026-06-10", "2026-06-11");
    const result = mergeQuote(
      nights,
      [pricing(1000, [{ date: "2026-06-10", price: 900 }])],
      [availability([{ date: "2026-06-10", isBlocked: true }])]
    );
    expect(result.available).toBe(false);
    expect(result.totalPrice).toBe(900);
  });

  it("treats a night missing from the pricing data as ฿0, not a crash", () => {
    const { nights } = getNightsAndMonths("2026-06-10", "2026-06-12");
    const result = mergeQuote(nights, [pricing(1000, [{ date: "2026-06-10", price: 1000 }])], []);
    // 06-11 has no pricing entry at all
    expect(result.totalPrice).toBe(1000);
  });
});
