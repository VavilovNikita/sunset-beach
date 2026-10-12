import { describe, expect, it } from "vitest";
import { MAX_LINE_QUANTITY, canAddOne, clampQuantity } from "@/lib/orderQuantity";

describe("order line quantity", () => {
  it("is capped at 99", () => {
    expect(MAX_LINE_QUANTITY).toBe(99);
  });

  it("lets a line grow until it holds 99, and no further", () => {
    expect(canAddOne(1)).toBe(true);
    expect(canAddOne(98)).toBe(true);
    expect(canAddOne(99)).toBe(false);
  });

  it("clamps into 1..99", () => {
    expect(clampQuantity(0)).toBe(1);
    expect(clampQuantity(-4)).toBe(1);
    expect(clampQuantity(7.9)).toBe(7);
    expect(clampQuantity(100)).toBe(99);
    expect(clampQuantity(Number.NaN)).toBe(1);
  });
});
