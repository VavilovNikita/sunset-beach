import { describe, expect, it } from "vitest";
import { cashTender, parseBahtToSatang } from "@/lib/cashTender";

describe("parseBahtToSatang", () => {
  it("reads whole baht, satang and thousands separators", () => {
    expect(parseBahtToSatang("500")).toBe(50000);
    expect(parseBahtToSatang("1,000.5")).toBe(100050);
    expect(parseBahtToSatang(" 0.25 ")).toBe(25);
  });

  it("rejects anything that isn't a plain amount", () => {
    expect(parseBahtToSatang("")).toBeNull();
    expect(parseBahtToSatang("-5")).toBeNull();
    expect(parseBahtToSatang("5.123")).toBeNull();
    expect(parseBahtToSatang("abc")).toBeNull();
  });
});

describe("cashTender", () => {
  it("gives the change against the server's total", () => {
    expect(cashTender("380.00", "500")).toEqual({ ok: true, tendered: "500.00", change: "120.00" });
  });

  it("exact money means no change", () => {
    expect(cashTender("380.00", "380")).toEqual({ ok: true, tendered: "380.00", change: "0.00" });
  });

  it("refuses less than the total and says how much is missing", () => {
    expect(cashTender("380.00", "300")).toEqual({ ok: false, reason: "insufficient", short: "80.00" });
  });

  it("never drifts on satang", () => {
    expect(cashTender("0.30", "0.50")).toEqual({ ok: true, tendered: "0.50", change: "0.20" });
  });

  it("an unparseable entry is invalid, not zero", () => {
    expect(cashTender("380.00", "")).toEqual({ ok: false, reason: "invalid" });
  });
});
