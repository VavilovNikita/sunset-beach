import { describe, expect, it } from "vitest";
import { followOutstanding, startFolioAmount, typeFolioAmount } from "@/lib/folioAmount";

describe("the folio amount box", () => {
  it("follows a new balance while untouched", () => {
    const next = followOutstanding(startFolioAmount("10000.00"), "20000.00");
    expect(next.amount).toBe("20000.00");
    expect(next.touched).toBe(false);
  });

  it("keeps what the person typed when the balance changes", () => {
    const typed = typeFolioAmount(startFolioAmount("10000.00"), "2500");
    const next = followOutstanding(typed, "20000.00");
    expect(next.amount).toBe("2500");
    expect(next.outstanding).toBe("20000.00");
  });

  it("is the same object when nothing changed", () => {
    const s = startFolioAmount("100.00");
    expect(followOutstanding(s, "100.00")).toBe(s);
  });
});
