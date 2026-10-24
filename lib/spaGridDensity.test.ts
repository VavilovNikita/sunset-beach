import { describe, expect, it } from "vitest";
import { DEFAULT_COL_WIDTH_PX, MIN_COL_WIDTH_PX, fitColWidth } from "@/lib/spaGridDensity";

describe("fitColWidth", () => {
  it("shrinks the columns until the day fits", () => {
    // 20 half-hour columns in a 1000px box with a 160px label column
    expect(fitColWidth(1000, 160, 20)).toBe(42);
  });
  it("never goes below the slider's minimum, nor above the old default", () => {
    expect(fitColWidth(600, 160, 30)).toBe(MIN_COL_WIDTH_PX);
    expect(fitColWidth(3000, 160, 10)).toBe(DEFAULT_COL_WIDTH_PX);
  });
  it("falls back to the default before the box is measured", () => {
    expect(fitColWidth(0, 160, 20)).toBe(DEFAULT_COL_WIDTH_PX);
  });
});
