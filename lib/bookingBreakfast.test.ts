import { describe, expect, it } from "vitest";
import { breakfastFormFrom, formatBreakfast, parseBreakfast } from "./bookingBreakfast";

describe("parseBreakfast", () => {
  it("is none for nothing or zero guests, whatever rate was left selected", () => {
    expect(parseBreakfast({ guests: "", rate: "" }, 2)).toEqual({ ok: true, breakfastGuests: null, breakfastRate: null });
    expect(parseBreakfast({ guests: " ", rate: "350" }, 2)).toEqual({ ok: true, breakfastGuests: null, breakfastRate: null });
    expect(parseBreakfast({ guests: "0", rate: "350" }, 2)).toEqual({ ok: true, breakfastGuests: null, breakfastRate: null });
  });

  it("takes guests with one of the two rates", () => {
    expect(parseBreakfast({ guests: "2", rate: "250" }, 2)).toEqual({ ok: true, breakfastGuests: 2, breakfastRate: 250 });
    expect(parseBreakfast({ guests: "1", rate: "350" }, 3)).toEqual({ ok: true, breakfastGuests: 1, breakfastRate: 350 });
  });

  it("asks for a rate, a whole number and a party that fits", () => {
    expect(parseBreakfast({ guests: "2", rate: "" }, 2).ok).toBe(false);
    expect(parseBreakfast({ guests: "2", rate: "300" }, 2).ok).toBe(false);
    expect(parseBreakfast({ guests: "1.5", rate: "250" }, 2).ok).toBe(false);
    expect(parseBreakfast({ guests: "-1", rate: "250" }, 2).ok).toBe(false);
    expect(parseBreakfast({ guests: "3", rate: "250" }, 2)).toEqual({ ok: false, error: "More breakfast guests than the party (2)." });
    expect(parseBreakfast({ guests: "51", rate: "250" }, 99).ok).toBe(false);
  });
});

describe("breakfastFormFrom / formatBreakfast", () => {
  it("round-trips what the server sent, and treats a missing field as none", () => {
    expect(breakfastFormFrom({ breakfastGuests: 2, breakfastRate: 350 })).toEqual({ guests: "2", rate: "350" });
    expect(breakfastFormFrom({})).toEqual({ guests: "", rate: "" });
    expect(breakfastFormFrom({ breakfastGuests: null, breakfastRate: null })).toEqual({ guests: "", rate: "" });
  });
  it("words it for the booking page", () => {
    expect(formatBreakfast({ breakfastGuests: 2, breakfastRate: 350 })).toBe("2 guests at ฿350 a night");
    expect(formatBreakfast({ breakfastGuests: 1, breakfastRate: 250 })).toBe("1 guest at ฿250 a night");
    expect(formatBreakfast({ breakfastGuests: null, breakfastRate: null })).toBeNull();
    expect(formatBreakfast({})).toBeNull();
  });
});
