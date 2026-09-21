import { describe, expect, it } from "vitest";
import { classifyRosterDrop, isValidSwapTarget, resolveShiftCodesForArea, type RosterDragSource, type RosterDropTarget } from "./rosterGrid";
import type { ShiftCode } from "./types";

const source: RosterDragSource = { entryId: "e1", employeeUserId: "emp-1", date: "2026-09-10" };

function target(overrides: Partial<RosterDropTarget> = {}): RosterDropTarget {
  return { employeeUserId: "emp-1", date: "2026-09-11", entry: null, ...overrides };
}

describe("classifyRosterDrop — move", () => {
  it("same employee, different date, empty target: move", () => {
    expect(classifyRosterDrop(source, target(), false)).toEqual({ kind: "move", entryId: "e1", date: "2026-09-11" });
  });

  it("same employee, same date (dropped back where it started): cancel", () => {
    expect(classifyRosterDrop(source, target({ date: "2026-09-10" }), false)).toEqual({ kind: "cancel" });
  });
});

describe("classifyRosterDrop — reassign", () => {
  it("different employee, same date, empty target: reassign", () => {
    expect(classifyRosterDrop(source, target({ employeeUserId: "emp-2", date: "2026-09-10" }), false)).toEqual({
      kind: "reassign",
      entryId: "e1",
      employeeUserId: "emp-2",
    });
  });
});

describe("classifyRosterDrop — swap", () => {
  it("dropped on another employee's occupied cell: swap, regardless of date", () => {
    const t = target({ employeeUserId: "emp-2", date: "2026-09-20", entry: { id: "e2", locked: false } });
    expect(classifyRosterDrop(source, t, false)).toEqual({ kind: "swap", entryId: "e1", otherEntryId: "e2" });
  });

  it("dropped on the same employee's own occupied cell elsewhere in the month: still a swap", () => {
    const t = target({ employeeUserId: "emp-1", date: "2026-09-25", entry: { id: "e2", locked: false } });
    expect(classifyRosterDrop(source, t, false)).toEqual({ kind: "swap", entryId: "e1", otherEntryId: "e2" });
  });

  it("dropped on itself: cancel", () => {
    const t = target({ entry: { id: "e1", locked: false } });
    expect(classifyRosterDrop(source, t, false)).toEqual({ kind: "cancel" });
  });

  it("dropped on a locked entry: cancel, never attempted as a swap", () => {
    const t = target({ employeeUserId: "emp-2", entry: { id: "e2", locked: true } });
    expect(classifyRosterDrop(source, t, false)).toEqual({ kind: "cancel" });
    expect(isValidSwapTarget(source, t)).toBe(false);
  });
});

describe("classifyRosterDrop — diagonal drop (both employee and date change)", () => {
  it("no single operation expresses both at once: cancel, not a guess", () => {
    const t = target({ employeeUserId: "emp-2", date: "2026-09-15" });
    expect(classifyRosterDrop(source, t, false)).toEqual({ kind: "cancel" });
  });
});

describe("classifyRosterDrop — the sticky swap rule", () => {
  it("once a valid swap target was hovered, a later drop on an empty cell cancels the whole gesture", () => {
    // Without stickiness this would read as an ordinary move - the true rule is "this drag became
    // a swap attempt the moment it touched a valid partner, and a miss after that cancels".
    expect(classifyRosterDrop(source, target(), true)).toEqual({ kind: "cancel" });
  });

  it("a drag that never touched a swap target still falls through to move/reassign on a miss", () => {
    expect(classifyRosterDrop(source, target(), false)).toEqual({ kind: "move", entryId: "e1", date: "2026-09-11" });
  });
});

function code(overrides: Partial<ShiftCode> = {}): ShiftCode {
  return {
    id: overrides.code ?? "code",
    staffArea: null,
    code: "9",
    startTime1: null,
    endTime1: null,
    startTime2: null,
    endTime2: null,
    countsAsWorked: true,
    isPaid: true,
    effectiveFrom: "2026-01-01",
    active: true,
    createdByEmail: "manager@example.com",
    createdAt: "2026-01-01T00:00:00Z",
    kind: null,
    suggestedKind: null,
    displayColor: null,
    suggestedColor: null,
    ...overrides,
  };
}

describe("resolveShiftCodesForArea", () => {
  it("a shared code (staffArea: null) is available in any area", () => {
    const shared = code({ id: "shared-7", code: "7", staffArea: null });
    expect(resolveShiftCodesForArea([shared], "RESTAURANT")).toEqual([shared]);
    expect(resolveShiftCodesForArea([shared], "KITCHEN")).toEqual([shared]);
  });

  it("an area-scoped code only shows for its own area", () => {
    const restaurantOnly = code({ id: "restaurant-9", code: "9", staffArea: "RESTAURANT" });
    expect(resolveShiftCodesForArea([restaurantOnly], "RESTAURANT")).toEqual([restaurantOnly]);
    expect(resolveShiftCodesForArea([restaurantOnly], "KITCHEN")).toEqual([]);
  });

  it("an area-scoped code wins over a shared code of the same `code` string, for that area only", () => {
    const shared = code({ id: "shared-9", code: "9", staffArea: null });
    const restaurantOverride = code({ id: "restaurant-9", code: "9", staffArea: "RESTAURANT" });

    // Restaurant sees only the override, not both rows.
    expect(resolveShiftCodesForArea([shared, restaurantOverride], "RESTAURANT")).toEqual([restaurantOverride]);
    // Every other area still resolves to the shared row, untouched by the override.
    expect(resolveShiftCodesForArea([shared, restaurantOverride], "KITCHEN")).toEqual([shared]);
  });

  it("a shared code with no colliding override appears alongside an unrelated area-scoped code", () => {
    const sharedOp = code({ id: "shared-op", code: "OP", staffArea: null });
    const restaurant9 = code({ id: "restaurant-9", code: "9", staffArea: "RESTAURANT" });
    expect(resolveShiftCodesForArea([sharedOp, restaurant9], "RESTAURANT")).toEqual([restaurant9, sharedOp]);
  });
});

describe("isValidSwapTarget", () => {
  it("true for another employee's unlocked entry", () => {
    expect(isValidSwapTarget(source, target({ employeeUserId: "emp-2", entry: { id: "e2", locked: false } }))).toBe(true);
  });

  it("false for an empty cell", () => {
    expect(isValidSwapTarget(source, target())).toBe(false);
  });

  it("false for the dragged entry's own cell", () => {
    expect(isValidSwapTarget(source, target({ entry: { id: "e1", locked: false } }))).toBe(false);
  });
});
