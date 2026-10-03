import { describe, expect, it } from "vitest";
import { formatDateOfBirth, formatTagsInput, isRepeatGuest, parseTagsInput } from "./guestProfile";

describe("parseTagsInput", () => {
  it("trims each tag and drops blank ones", () => {
    expect(parseTagsInput(", honeymoon ,  , late checkout,")).toEqual(["honeymoon", "late checkout"]);
  });

  it("drops exact duplicates but keeps near-duplicates as typed", () => {
    expect(parseTagsInput("vip, VIP, vip")).toEqual(["vip", "VIP"]);
  });

  it("returns an empty array for an empty field", () => {
    expect(parseTagsInput("   ")).toEqual([]);
  });

  it("round-trips with formatTagsInput", () => {
    const tags = ["honeymoon", "allergic to shellfish"];
    expect(parseTagsInput(formatTagsInput(tags))).toEqual(tags);
  });
});

describe("formatDateOfBirth", () => {
  it("formats a date-only key without shifting the day", () => {
    expect(formatDateOfBirth("1987-04-12")).toBe("12 Apr 1987");
    expect(formatDateOfBirth("2000-01-01")).toBe("1 Jan 2000");
  });
});

describe("isRepeatGuest", () => {
  it("is true with two non-cancelled bookings", () => {
    expect(isRepeatGuest([{ status: "PAID" }, { status: "NEW" }])).toBe(true);
  });

  it("is false with one non-cancelled booking, however many cancelled ones there are", () => {
    expect(isRepeatGuest([{ status: "CONFIRMED" }, { status: "CANCELLED" }, { status: "CANCELLED" }])).toBe(false);
  });

  it("is false with no bookings", () => {
    expect(isRepeatGuest([])).toBe(false);
  });
});
