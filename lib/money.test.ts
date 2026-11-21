import { describe, expect, it } from "vitest";
import { formatBaht } from "@/lib/money";

describe("formatBaht", () => {
  it("shows satang only when there are some, and then always two digits", () => {
    expect(formatBaht("8000")).toBe("฿8,000");
    expect(formatBaht("8000.00")).toBe("฿8,000");
    expect(formatBaht("8000.50")).toBe("฿8,000.50");
    expect(formatBaht("1280.5")).toBe("฿1,280.50");
    expect(formatBaht("0.05")).toBe("฿0.05");
    expect(formatBaht(1234.5)).toBe("฿1,234.50");
  });

  it("rounds to satang and keeps the sign", () => {
    expect(formatBaht("10.004")).toBe("฿10");
    expect(formatBaht("10.995")).toBe("฿11");
    expect(formatBaht("-500")).toBe("−฿500");
    expect(formatBaht("-0.001")).toBe("฿0");
  });
});
