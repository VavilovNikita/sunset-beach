import { describe, expect, it } from "vitest";
import { formatPartySize, parsePartySize } from "./bookingPurpose";

describe("parsePartySize", () => {
  it("parses whole numbers", () => {
    expect(parsePartySize("2", "1")).toEqual({ adults: 2, children: 1 });
  });

  it("treats an empty children field as 0", () => {
    expect(parsePartySize("1", "")).toEqual({ adults: 1, children: 0 });
    expect(parsePartySize("1", "  ")).toEqual({ adults: 1, children: 0 });
  });

  it("rejects no adults, zero adults and fractions", () => {
    expect(parsePartySize("", "0")).toHaveProperty("error");
    expect(parsePartySize("0", "0")).toHaveProperty("error");
    expect(parsePartySize("1.5", "0")).toHaveProperty("error");
  });

  it("rejects negative or fractional children", () => {
    expect(parsePartySize("2", "-1")).toHaveProperty("error");
    expect(parsePartySize("2", "0.5")).toHaveProperty("error");
  });
});

describe("formatPartySize", () => {
  it("pluralizes and leaves out zero children", () => {
    expect(formatPartySize(1, 0)).toBe("1 adult");
    expect(formatPartySize(2, 1)).toBe("2 adults, 1 child");
    expect(formatPartySize(2, 3)).toBe("2 adults, 3 children");
  });
});
