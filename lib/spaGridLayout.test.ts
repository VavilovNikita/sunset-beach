import { describe, expect, it } from "vitest";
import { buildSlotColumns, slotIndexOf, slotSpanOf } from "./spaGridLayout";

describe("buildSlotColumns", () => {
  it("builds half-open [opening, closing) columns at the given step", () => {
    expect(buildSlotColumns("09:00", "10:30", 30)).toEqual(["09:00", "09:30", "10:00"]);
  });

  it("closing time itself is never its own column", () => {
    const columns = buildSlotColumns("09:00", "20:00", 30);
    expect(columns).not.toContain("20:00");
    expect(columns[columns.length - 1]).toBe("19:30");
  });
});

describe("slotIndexOf", () => {
  it("is 0 at opening time", () => {
    expect(slotIndexOf("09:00", "09:00", 30)).toBe(0);
  });

  it("counts whole slots from opening", () => {
    expect(slotIndexOf("11:00", "09:00", 30)).toBe(4);
  });
});

describe("slotSpanOf", () => {
  it("an exact multiple of slotMinutes spans that many slots", () => {
    expect(slotSpanOf(60, 30)).toBe(2);
  });

  it("rounds up rather than truncating to zero width", () => {
    expect(slotSpanOf(45, 30)).toBe(2);
    expect(slotSpanOf(1, 30)).toBe(1);
  });
});
