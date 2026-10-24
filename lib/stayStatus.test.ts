import { describe, expect, it } from "vitest";
import { stayStatusLabel } from "@/lib/stayStatus";

describe("stayStatusLabel", () => {
  it("prefers the server's stayStatus", () => {
    expect(stayStatusLabel({ status: "NEW", occupancyStatus: "EXPECTED", stayStatus: "CHECKED_OUT" })).toBe("Checked out");
  });
  it("derives it when the server does not send it", () => {
    expect(stayStatusLabel({ status: "NEW", occupancyStatus: "CHECKED_OUT" })).toBe("Checked out");
    expect(stayStatusLabel({ status: "CONFIRMED", occupancyStatus: "CHECKED_IN" })).toBe("In house");
    expect(stayStatusLabel({ status: "CANCELLED", occupancyStatus: "CHECKED_IN" })).toBe("Cancelled");
    expect(stayStatusLabel({ status: "PAID", occupancyStatus: "NO_SHOW" })).toBe("No-show");
    expect(stayStatusLabel({ status: "PAID", occupancyStatus: "EXPECTED" })).toBe("Upcoming");
  });
});
