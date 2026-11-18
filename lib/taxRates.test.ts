import { describe, expect, it } from "vitest";
import { parseRate, rateChanged } from "./taxRates";

describe("parseRate", () => {
  it("accepts a percentage with up to two decimals, a comma too", () => {
    expect(parseRate("10", "VAT")).toEqual({ ok: true, rate: 10 });
    expect(parseRate(" 7.5 ", "VAT")).toEqual({ ok: true, rate: 7.5 });
    expect(parseRate("7,25", "VAT")).toEqual({ ok: true, rate: 7.25 });
    expect(parseRate("0", "VAT")).toEqual({ ok: true, rate: 0 });
    expect(parseRate("99.99", "VAT")).toEqual({ ok: true, rate: 99.99 });
  });
  it("refuses everything else, naming the field", () => {
    for (const bad of ["", "abc", "-1", "100", "7.123", "1e1", "7%"]) {
      const r = parseRate(bad, "Service charge");
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.error).toMatch(/^Service charge/);
    }
  });
});

describe("rateChanged", () => {
  it("is the percentage that changes, not the spelling", () => {
    expect(rateChanged("10.00", "10")).toBe(false);
    expect(rateChanged("10.00", "10.0")).toBe(false);
    expect(rateChanged("7.00", "7.5")).toBe(true);
    expect(rateChanged("7.00", "oops")).toBe(true);
  });
});
