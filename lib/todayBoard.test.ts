import { describe, expect, it } from "vitest";
import { applyCheckedIn, applyCheckedOut, applyNoShow } from "./todayBoard";
import type { Booking, TodayBoard, TodayBoardEntry } from "./types";

function entry(id: string, outstandingBalance = "0.00", overdueDays?: number): TodayBoardEntry {
  return { booking: { id, guestName: `Guest ${id}`, occupancyStatus: "EXPECTED" } as unknown as Booking, outstandingBalance, overdueDays };
}

const board: TodayBoard = {
  arrivingToday: [entry("a1", "1500.00"), entry("a2")],
  departingToday: [entry("d1", "300.00")],
  inHouse: [entry("d1", "300.00"), entry("h1")],
};

describe("applyCheckedIn", () => {
  it("moves the guest from arriving to the house, as saved by the server, keeping the amount owed", () => {
    const saved = { id: "a1", guestName: "Guest a1", occupancyStatus: "CHECKED_IN" } as unknown as Booking;
    const next = applyCheckedIn(board, board.arrivingToday[0], saved);

    expect(next.arrivingToday.map((e) => e.booking.id)).toEqual(["a2"]);
    expect(next.inHouse.map((e) => e.booking.id)).toEqual(["a1", "d1", "h1"]);
    expect(next.inHouse[0].booking.occupancyStatus).toBe("CHECKED_IN");
    expect(next.inHouse[0].outstandingBalance).toBe("1500.00");
    expect(next.inHouse[0].overdueDays).toBe(0);
    expect(next.departingToday).toBe(board.departingToday);
  });

  it("never lists the same guest twice", () => {
    const again = applyCheckedIn(applyCheckedIn(board, board.arrivingToday[0], board.arrivingToday[0].booking), board.arrivingToday[0], board.arrivingToday[0].booking);
    expect(again.inHouse.filter((e) => e.booking.id === "a1")).toHaveLength(1);
  });
});

describe("applyCheckedOut", () => {
  it("removes the guest from departing and the house at once", () => {
    const next = applyCheckedOut(board, "d1");
    expect(next.departingToday).toEqual([]);
    expect(next.inHouse.map((e) => e.booking.id)).toEqual(["h1"]);
    expect(next.arrivingToday).toBe(board.arrivingToday);
  });

  it("leaves the board alone for a guest who is not on it", () => {
    const next = applyCheckedOut(board, "nobody");
    expect(next.inHouse).toHaveLength(2);
    expect(next.departingToday).toHaveLength(1);
  });
});

describe("applyNoShow", () => {
  it("removes the guest from arriving and touches nothing else", () => {
    const next = applyNoShow(board, "a2");
    expect(next.arrivingToday.map((e) => e.booking.id)).toEqual(["a1"]);
    expect(next.inHouse).toBe(board.inHouse);
    expect(next.departingToday).toBe(board.departingToday);
  });
});
