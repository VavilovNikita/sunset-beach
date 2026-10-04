import { describe, expect, it } from "vitest";
import { isChargeableToRoom } from "./roomCharge";

// The bugs this guards: a walk-in (created NEW, checked in) didn't appear in POS's "charge to
// room" list until someone changed its status to CONFIRMED; before that, a prepaid (PAID) stay
// dropped out of it. Occupancy decides, not booking status - see roomCharge.ts.
describe("isChargeableToRoom", () => {
  it("allows a checked-in walk-in whose status is still NEW", () => {
    expect(isChargeableToRoom({ status: "NEW", occupancyStatus: "CHECKED_IN" })).toBe(true);
  });

  it("allows a checked-in prepaid stay (PAID)", () => {
    expect(isChargeableToRoom({ status: "PAID", occupancyStatus: "CHECKED_IN" })).toBe(true);
  });

  it("allows a checked-in confirmed stay", () => {
    expect(isChargeableToRoom({ status: "CONFIRMED", occupancyStatus: "CHECKED_IN" })).toBe(true);
  });

  it("rejects a guest who hasn't arrived yet", () => {
    expect(isChargeableToRoom({ status: "CONFIRMED", occupancyStatus: "EXPECTED" })).toBe(false);
  });

  it("rejects a guest who has already checked out", () => {
    expect(isChargeableToRoom({ status: "PAID", occupancyStatus: "CHECKED_OUT" })).toBe(false);
  });

  it("rejects a cancelled booking even if its occupancy was never cleared", () => {
    expect(isChargeableToRoom({ status: "CANCELLED", occupancyStatus: "CHECKED_IN" })).toBe(false);
  });
});
