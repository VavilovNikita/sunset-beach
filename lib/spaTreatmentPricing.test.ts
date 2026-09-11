import { describe, expect, it } from "vitest";
import { sumTreatmentPrices } from "./spaTreatmentPricing";

describe("sumTreatmentPrices", () => {
  it("adds decimal-string prices together", () => {
    expect(sumTreatmentPrices(["1500.00", "800.00"])).toBe(2300);
  });

  it("returns zero for an empty list", () => {
    expect(sumTreatmentPrices([])).toBe(0);
  });

  it("handles a single price", () => {
    expect(sumTreatmentPrices(["250.50"])).toBe(250.5);
  });

  it("adds more than two prices", () => {
    expect(sumTreatmentPrices(["100.00", "200.00", "300.00"])).toBe(600);
  });
});
