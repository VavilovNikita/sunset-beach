import { describe, expect, it } from "vitest";
import { closeNoteMissing, closeNoteRequired, isLongOpenShift, reconcileCash, shiftOpeningFacts } from "./shiftReconciliation";
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

  it("includes cash taken at reception against a booking's folio", () => {
    const result = reconcileCash(
      shift({ openingCashFloat: "1000.00", totals: { cash: "500.00", card: "0", roomCharge: "0", other: "0", paymentCount: 1, folioCash: "450.00" } }),
      "",
    );
    expect(result.expectedCash).toBe(1950);
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

describe("isLongOpenShift", () => {
  const now = new Date("2026-10-03T12:00:00Z");

  it("flags an open shift after a full day", () => {
    expect(isLongOpenShift({ status: "OPEN", openedAt: "2026-09-02T01:00:00Z" }, now)).toBe(true);
    expect(isLongOpenShift({ status: "OPEN", openedAt: "2026-10-02T12:00:00Z" }, now)).toBe(true);
  });

  it("leaves a shift open less than a day alone", () => {
    expect(isLongOpenShift({ status: "OPEN", openedAt: "2026-10-02T12:00:01Z" }, now)).toBe(false);
  });

  it("never flags a closed shift, however old", () => {
    expect(isLongOpenShift({ status: "CLOSED", openedAt: "2026-09-02T01:00:00Z" }, now)).toBe(false);
  });
});

describe("closeNote", () => {
  it("is needed whenever the counted cash differs from the expected cash, over or short", () => {
    expect(closeNoteRequired(-50)).toBe(true);
    expect(closeNoteRequired(20)).toBe(true);
    expect(closeNoteRequired(0)).toBe(false);
    expect(closeNoteRequired(null)).toBe(false);
  });

  it("is missing when empty or only invisible characters, present with any text", () => {
    expect(closeNoteMissing(-50, "")).toBe(true);
    expect(closeNoteMissing(-50, "  \u00a0\u200b ")).toBe(true);
    expect(closeNoteMissing(-50, "paid the delivery from the drawer")).toBe(false);
    expect(closeNoteMissing(0, "")).toBe(false);
  });
});

describe("history table labels", () => {
  it("tells a drawer that was never counted from one that matched", async () => {
    const { countedCashLabel, discrepancyLabel } = await import("@/lib/shiftReconciliation");
    const notCounted = { status: "CLOSED" as const, closingCashCounted: null, discrepancy: null, cashNotCounted: true };
    expect(countedCashLabel(notCounted)).toBe("Not counted");
    expect(discrepancyLabel(notCounted)).toBe("Not counted");
    const matched = { status: "CLOSED" as const, closingCashCounted: "1000.00", discrepancy: "0.00" };
    expect(countedCashLabel(matched)).toBe("฿1,000");
    expect(discrepancyLabel(matched)).toBe("฿0");
    expect(discrepancyLabel({ ...matched, discrepancy: "-50.00" })).toBe("−฿50");
    expect(discrepancyLabel({ status: "OPEN", closingCashCounted: null, discrepancy: null })).toBe("—");
  });
});
