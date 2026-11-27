import { describe, expect, it } from "vitest";
import { checkOutAmounts } from "./checkOutAmounts";

describe("checkOutAmounts", () => {
  it("words the server's two figures when tonight's night is not charged", () => {
    expect(checkOutAmounts({ tonightNotCharged: true, balanceDueNow: "45000.00", outstandingBalance: "40000.00" })).toEqual({
      owedNow: "Owed now ฿45,000 (incl. tonight)",
      afterCheckOut: "Balance after check-out ฿40,000 — tonight's night is not charged when they leave today",
    });
  });

  it("shows them also when nothing is left to pay after check-out", () => {
    expect(checkOutAmounts({ tonightNotCharged: true, balanceDueNow: "5000.00", outstandingBalance: "0.00" })?.afterCheckOut).toContain("฿0");
  });

  it("has one figure otherwise", () => {
    expect(checkOutAmounts({ tonightNotCharged: false, balanceDueNow: "100.00", outstandingBalance: "100.00" })).toBeNull();
  });
});
