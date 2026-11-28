import { describe, expect, it } from "vitest";
import { housekeepingCode } from "@/lib/housekeepingCode";

describe("housekeepingCode", () => {
  it("crosses occupancy with cleaning state", () => {
    expect(housekeepingCode({ occupied: false, housekeepingStatus: "CLEAN" })).toBe("VC");
    expect(housekeepingCode({ occupied: false, housekeepingStatus: "DIRTY" })).toBe("VD");
    expect(housekeepingCode({ occupied: true, housekeepingStatus: "CLEAN" })).toBe("OC");
    expect(housekeepingCode({ occupied: true, housekeepingStatus: "DIRTY" })).toBe("OD");
  });
});
