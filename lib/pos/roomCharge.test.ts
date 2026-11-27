import { describe, expect, it } from "vitest";
import { isChargeableToRoom, pickRoomChargeSelection, roomChargeList } from "./roomCharge";

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

describe("roomChargeList", () => {
  const rows = [{ id: "early" }, { id: "own" }, { id: "late" }];

  it("lists the order's own guest first, so the selected row is on screen", () => {
    expect(roomChargeList(rows, "own", null, "").map((b) => b.id)).toEqual(["own", "early", "late"]);
    expect(roomChargeList(rows, "own", null, "ow").map((b) => b.id)).toEqual(["own", "early", "late"]);
  });

  it("adds the order's guest when the listing lacks them", () => {
    expect(roomChargeList([{ id: "early" }], "own", { id: "own" }, "").map((b) => b.id)).toEqual(["own", "early"]);
  });

  it("does not push them into the results of a name that did not match them", () => {
    expect(roomChargeList([{ id: "early" }], "own", { id: "own" }, "zed").map((b) => b.id)).toEqual(["early"]);
  });

  it("is the search's own list for an order without a guest, or a guest who cannot be charged", () => {
    expect(roomChargeList(rows, null, null, "")).toEqual(rows);
    expect(roomChargeList(rows, "gone", null, "")).toEqual(rows);
  });
});

