import { describe, expect, it } from "vitest";
import { reconcileCash, shiftOpeningFacts } from "./shiftReconciliation";
import type { ShiftSummary } from "./posTypes";

function shift(overrides: Partial<ShiftSummary>): ShiftSummary {
  return {
    id: "shift-1",
    openedByUserId: "user-1",
    openedAt: "2026-06-15T09:00:00.000Z",
    closedByUserId: null,
    closedAt: null,
    openingCashFloat: "1000.00",
    closingCashCounted: null,
    status: "OPEN",
    notes: null,
    totals: { cash: "500.00", card: "300.00", roomCharge: "0.00", other: "0.00", paymentCount: 3 },
    ...overrides,
  };
}

describe("reconcileCash", () => {
  it("computes expected cash as opening float plus cash payments", () => {
    const result = reconcileCash(shift({ openingCashFloat: "1000.00", totals: { cash: "500.00", card: "0", roomCharge: "0", other: "0", paymentCount: 1 } }), "");
    expect(result.expectedCash).toBe(1500);
  });

  it("treats a null opening float as zero", () => {
    const result = reconcileCash(shift({ openingCashFloat: null, totals: { cash: "500.00", card: "0", roomCharge: "0", other: "0", paymentCount: 1 } }), "");
    expect(result.expectedCash).toBe(500);
  });

  it("reports counted/discrepancy as null before any count is entered", () => {
    const result = reconcileCash(shift({}), "");
    expect(result.counted).toBeNull();
    expect(result.discrepancy).toBeNull();
  });

  it("uses the live input while the shift is still open (not yet closed)", () => {
    const result = reconcileCash(shift({ openingCashFloat: "1000.00", totals: { cash: "500.00", card: "0", roomCharge: "0", other: "0", paymentCount: 1 } }), "1500");
    expect(result.counted).toBe(1500);
    expect(result.discrepancy).toBe(0);
  });

  it("prefers the shift's own persisted closingCashCounted over the live input once closed", () => {
    const result = reconcileCash(
      shift({
        status: "CLOSED",
        openingCashFloat: "1000.00",
        closingCashCounted: "1450.00",
        totals: { cash: "500.00", card: "0", roomCharge: "0", other: "0", paymentCount: 1 },
      }),
      "9999" // must be ignored - the persisted value wins
    );
    expect(result.counted).toBe(1450);
    expect(result.discrepancy).toBe(-50);
  });

  it("reports a positive discrepancy when there's more cash than expected", () => {
    const result = reconcileCash(shift({ openingCashFloat: "1000.00", totals: { cash: "500.00", card: "0", roomCharge: "0", other: "0", paymentCount: 1 } }), "1600");
    expect(result.discrepancy).toBe(100);
  });

  it("reports a negative discrepancy when there's less cash than expected", () => {
    const result = reconcileCash(shift({ openingCashFloat: "1000.00", totals: { cash: "500.00", card: "0", roomCharge: "0", other: "0", paymentCount: 1 } }), "1400");
    expect(result.discrepancy).toBe(-100);
  });

  it("treats an empty live input as no count yet, not zero", () => {
    const result = reconcileCash(shift({ openingCashFloat: "1000.00", totals: { cash: "500.00", card: "0", roomCharge: "0", other: "0", paymentCount: 1 } }), "");
    expect(result.counted).toBeNull();
  });
});

describe("shiftOpeningFacts", () => {
  it("names who opened the drawer, when (hotel time), and the float", () => {
    expect(shiftOpeningFacts(shift({ openedByEmail: "anna@sunset.test", openingCashFloat: "2000.00" }))).toEqual({
      openedBy: "anna@sunset.test",
      openedAt: "15 Jun 2026, 16:00",
      openingFloat: "฿2,000",
    });
  });

  // A float left blank at open is not a ฿0 float - the reconciliation treats it as 0, but the
  // screen says it was never entered.
  it("says the float was not entered rather than showing ฿0", () => {
    expect(shiftOpeningFacts(shift({ openingCashFloat: null })).openingFloat).toBe("Not entered");
  });
});
