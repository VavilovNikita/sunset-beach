import { describe, expect, it } from "vitest";
import { normalizeMoneyInput } from "@/lib/moneyInput";

describe("normalizeMoneyInput", () => {
  it("accepts a comma as the decimal separator and always shows a dot", () => {
    expect(normalizeMoneyInput("7000,00")).toBe("7000.00");
    expect(normalizeMoneyInput("7000.50")).toBe("7000.50");
  });
  it("drops spaces, letters and a second decimal point", () => {
    expect(normalizeMoneyInput("7 000")).toBe("7000");
    expect(normalizeMoneyInput("12abc")).toBe("12");
    expect(normalizeMoneyInput("1.2.3")).toBe("1.23");
    expect(normalizeMoneyInput("")).toBe("");
  });
});
