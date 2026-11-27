import { describe, expect, it } from "vitest";
import { isChargeableToRoom, pickRoomChargeSelection } from "./roomCharge";

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

describe("pickRoomChargeSelection", () => {
  const list = [{ id: "first" }, { id: "appointment-guest" }, { id: "third" }];

  it("opens on the guest the order belongs to, not the first row", () => {
    expect(pickRoomChargeSelection(list, null, "appointment-guest")).toBe("appointment-guest");
  });

  it("keeps a pick the cashier already made", () => {
    expect(pickRoomChargeSelection(list, "third", "appointment-guest")).toBe("third");
  });

  it("selects nobody for an order that belongs to nobody until a row is tapped", () => {
    expect(pickRoomChargeSelection(list, null, null)).toBeNull();
    expect(pickRoomChargeSelection([], null, null)).toBeNull();
  });

  it("selects nobody when a search leaves one match", () => {
    expect(pickRoomChargeSelection([{ id: "first" }], null, null)).toBeNull();
  });

  it("does not fall back to a stranger when the order's guest is not in the list", () => {
    expect(pickRoomChargeSelection([{ id: "first" }], null, "appointment-guest")).toBeNull();
  });

  it("drops a pick that is no longer in the list instead of moving it to another guest", () => {
    expect(pickRoomChargeSelection([{ id: "first" }], "third", null)).toBeNull();
  });
});
