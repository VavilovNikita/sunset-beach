import { describe, expect, it } from "vitest";
import { describeDifference, figuresFor, rateChoices, rateModeToSend, roomDropIntent } from "./bookingRelocation";
import type { RelocationQuote } from "./types";

const crossType: RelocationQuote = {
  totalPrice: "9000.00",
  nights: 3,
  available: true,
  reason: null,
  currentTotalPrice: "3000.00",
  sameRoomType: false,
  wholeSegment: true,
  rateMode: "NEW_RATE",
  mayKeepRate: true,
  keepRateTotalPrice: "3000.00",
  keepRatePriceDifference: "0.00",
  newRateTotalPrice: "9000.00",
  newRatePriceDifference: "6000.00",
};
const sameType: RelocationQuote = {
  ...crossType,
  totalPrice: "3000.00",
  sameRoomType: true,
  rateMode: "KEEP_RATE",
  newRateTotalPrice: null,
  newRatePriceDifference: null,
};

describe("rateChoices", () => {
  it("offers both rates across room types, with the server's totals and differences", () => {
    expect(rateChoices(crossType)).toEqual([
      { mode: "NEW_RATE", total: "9000.00", difference: "6000.00", allowed: true },
      { mode: "KEEP_RATE", total: "3000.00", difference: "0.00", allowed: true },
    ]);
  });

  it("marks the original rate as not allowed for a user who may not apply it", () => {
    const keep = rateChoices({ ...crossType, mayKeepRate: false }).find((c) => c.mode === "KEEP_RATE");
    expect(keep?.allowed).toBe(false);
  });

  it("offers nothing within one room type - the price cannot change", () => {
    expect(rateChoices(sameType)).toEqual([]);
  });
});

describe("rateModeToSend", () => {
  it("sends nothing within one room type", () => {
    expect(rateModeToSend(sameType, "NEW_RATE")).toBeUndefined();
    expect(rateModeToSend(sameType, null)).toBeUndefined();
  });

  it("sends the new rate unless the user picked the original one and may apply it", () => {
    expect(rateModeToSend(crossType, null)).toBe("NEW_RATE");
    expect(rateModeToSend(crossType, "NEW_RATE")).toBe("NEW_RATE");
    expect(rateModeToSend(crossType, "KEEP_RATE")).toBe("KEEP_RATE");
  });

  it("never sends the original rate for a user who may not apply it", () => {
    expect(rateModeToSend({ ...crossType, mayKeepRate: false }, "KEEP_RATE")).toBe("NEW_RATE");
  });
});

describe("figuresFor", () => {
  it("reads the figures of the chosen mode straight from the quote", () => {
    expect(figuresFor(crossType, "NEW_RATE")).toEqual({ total: "9000.00", difference: "6000.00" });
    expect(figuresFor(crossType, "KEEP_RATE")).toEqual({ total: "3000.00", difference: "0.00" });
    expect(figuresFor(sameType, undefined)).toEqual({ total: "3000.00", difference: "0.00" });
  });
});

describe("describeDifference", () => {
  it("formats the server's signed string without doing arithmetic on prices", () => {
    expect(describeDifference("6000.00")).toEqual({ text: "+฿6,000", tone: "up" });
    expect(describeDifference("-500.50")).toEqual({ text: "−฿500.5", tone: "down" });
    expect(describeDifference("0.00")).toEqual({ text: "No change", tone: "none" });
  });
});

describe("roomDropIntent", () => {
  const base = { todayKey: "2026-11-21", occupancyStatus: "EXPECTED" as const, barRoomId: "std", targetRoomId: "std", segmentCount: 1 };

  it("another room type always opens the room-move dialog - from today for a stay under way, else from its first night", () => {
    expect(roomDropIntent({ ...base, targetRoomId: "suite", barCheckIn: "2026-11-19", barCheckOut: "2026-11-24" })).toEqual({
      kind: "relocate",
      effectiveDate: "2026-11-21",
    });
    expect(roomDropIntent({ ...base, targetRoomId: "suite", barCheckIn: "2026-11-21", barCheckOut: "2026-11-24" })).toEqual({
      kind: "relocate",
      effectiveDate: "2026-11-21",
    });
    expect(roomDropIntent({ ...base, targetRoomId: "suite", barCheckIn: "2026-12-05", barCheckOut: "2026-12-08" })).toEqual({
      kind: "relocate",
      effectiveDate: "2026-12-05",
    });
  });

  it("a segment that is entirely in the past cannot be moved to another type", () => {
    expect(roomDropIntent({ ...base, targetRoomId: "suite", barCheckIn: "2026-11-10", barCheckOut: "2026-11-15" })).toEqual({ kind: "none" });
  });

  it("a guest in the house moved within the type is a room move from today - the nights slept stay put", () => {
    expect(roomDropIntent({ ...base, occupancyStatus: "CHECKED_IN", barCheckIn: "2026-11-19", barCheckOut: "2026-11-24" })).toEqual({
      kind: "relocate",
      effectiveDate: "2026-11-21",
    });
  });

  it("nobody in the room: the ordinary room change, as before", () => {
    expect(roomDropIntent({ ...base, barCheckIn: "2026-11-21", barCheckOut: "2026-11-24" })).toEqual({ kind: "schedule" });
    expect(roomDropIntent({ ...base, barCheckIn: "2026-12-05", barCheckOut: "2026-12-08" })).toEqual({ kind: "schedule" });
    expect(roomDropIntent({ ...base, segmentCount: 2, barCheckIn: "2026-12-05", barCheckOut: "2026-12-08" })).toEqual({ kind: "segment-unit" });
  });
});
