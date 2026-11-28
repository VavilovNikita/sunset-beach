import { describe, expect, it } from "vitest";
import { findSpaOccupant, resolveSpaDrop, spaDragBlock, spaDropMessage } from "./spaDrag";

describe("spaDragBlock", () => {
  it("lets a booked appointment be picked up while the day still has a slot ahead", () => {
    expect(spaDragBlock({ status: "BOOKED", guestName: "Anna" }, false)).toBeNull();
  });

  it("holds a booked appointment on a day with no slot left, and says what to do", () => {
    expect(spaDragBlock({ status: "BOOKED", guestName: "Anna" }, true)).toContain("no slot of this day is still ahead");
  });

  it("says why anything else cannot move", () => {
    expect(spaDragBlock({ status: "COMPLETED", guestName: "Anna" }, false)).toBe("Anna's appointment is completed - it can't be moved.");
    expect(spaDragBlock({ status: "CANCELLED", guestName: "Anna" }, true)).toContain("cancelled");
    expect(spaDragBlock({ status: "NO_SHOW", guestName: "Anna" }, false)).toContain("no-show");
  });
});

describe("spaDropMessage", () => {
  it("always says that nothing was changed and why", () => {
    for (const miss of [
      { kind: "outside" } as const,
      { kind: "interrupted" } as const,
      { kind: "occupied", otherGuestName: "Boris" } as const,
    ]) {
      expect(spaDropMessage(miss, "Anna"), miss.kind).toMatch(/^Nothing was changed: Anna/);
    }
    expect(spaDropMessage({ kind: "past", startTime: "09:00" }, "Anna")).toContain("09:00 has already passed");
  });
});

const grid = { openingTime: "09:00", slotMinutes: 30 };
type Row = { id: string; guestName: string; tableId: string; startTime: string; durationMinutes: number; status: "BOOKED" | "COMPLETED" | "CANCELLED" | "NO_SHOW" };
const row = (id: string, tableId: string, startTime: string, status: Row["status"] = "BOOKED", durationMinutes = 60): Row => ({
  id,
  guestName: id,
  tableId,
  startTime,
  durationMinutes,
  status,
});
// Anna on T1 at 10:00; Boris on T2 at 12:00-13:00; a completed one on T2 at 14:00; a cancelled one on T3 at 12:00.
const anna = row("Anna", "T1", "10:00");
const day = [anna, row("Boris", "T2", "12:00"), row("Done", "T2", "14:00", "COMPLETED"), row("Gone", "T3", "12:00", "CANCELLED"), row("Later", "T1", "15:00")];
const drop = (cell: { tableId: string; startTime: string } | null, past = false) => resolveSpaDrop(cell, anna, day, grid, () => past);

describe("findSpaOccupant", () => {
  it("answers from the table and the slot, over the whole length of an appointment", () => {
    expect(findSpaOccupant(day, { tableId: "T2", startTime: "12:30" }, "Anna", grid)?.id).toBe("Boris");
    expect(findSpaOccupant(day, { tableId: "T2", startTime: "13:00" }, "Anna", grid)).toBeUndefined();
    expect(findSpaOccupant(day, { tableId: "T2", startTime: "11:30" }, "Anna", grid)).toBeUndefined();
  });

  it("counts a part slot as taken, and never the dragged appointment or one that holds nothing", () => {
    expect(findSpaOccupant([row("Short", "T2", "12:00", "BOOKED", 45)], { tableId: "T2", startTime: "12:30" }, "Anna", grid)?.id).toBe("Short");
    expect(findSpaOccupant(day, { tableId: "T1", startTime: "10:30" }, "Anna", grid)).toBeUndefined();
    expect(findSpaOccupant(day, { tableId: "T3", startTime: "12:00" }, "Anna", grid)).toBeUndefined();
  });
});

describe("resolveSpaDrop", () => {
  it("moves onto a free slot - what the drag passed over plays no part", () => {
    expect(drop({ tableId: "T2", startTime: "16:00" })).toEqual({ kind: "move", cell: { tableId: "T2", startTime: "16:00" } });
    // A cancelled appointment is drawn there, but the slot is free.
    expect(drop({ tableId: "T3", startTime: "12:00" }).kind).toBe("move");
    // Half an appointment further on its own table.
    expect(drop({ tableId: "T1", startTime: "10:30" }).kind).toBe("move");
  });

  it("swaps tables when released on a booked appointment of another table", () => {
    const result = drop({ tableId: "T2", startTime: "12:30" });
    expect(result.kind === "swap" && result.other.id).toBe("Boris");
    // A swap moves no time, so a past slot under the pointer is no reason against it.
    expect(drop({ tableId: "T2", startTime: "12:00" }, true).kind).toBe("swap");
  });

  it("says the slot is taken on a completed appointment, and on one of its own table", () => {
    expect(drop({ tableId: "T2", startTime: "14:00" })).toEqual({ kind: "miss", miss: { kind: "occupied", otherGuestName: "Done" } });
    expect(drop({ tableId: "T1", startTime: "15:00" })).toEqual({ kind: "miss", miss: { kind: "occupied", otherGuestName: "Later" } });
  });

  it("misses off the grid and onto a past slot, and does nothing where it started", () => {
    expect(drop(null)).toEqual({ kind: "miss", miss: { kind: "outside" } });
    expect(drop({ tableId: "T2", startTime: "09:00" }, true)).toEqual({ kind: "miss", miss: { kind: "past", startTime: "09:00" } });
    expect(drop({ tableId: "T1", startTime: "10:00" }, true)).toEqual({ kind: "stay" });
  });
});
