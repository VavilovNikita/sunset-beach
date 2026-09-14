import type { ShiftCode, StaffArea, Weekday } from "@/lib/types";

export const STAFF_AREA_LABELS: Record<StaffArea, string> = {
  ADMIN: "Admin",
  FRONT_OFFICE: "Front office",
  MAINTENANCE: "Maintenance",
  HOUSEKEEPING: "Housekeeping",
  RESTAURANT: "Restaurant",
  KITCHEN: "Kitchen",
};

// Mirrors ShiftCodeService#list's own resolution on the backend (GET /shift-codes?staffArea=X):
// every area-scoped code for this area, plus every shared (staffArea: null) code whose `code`
// string isn't also defined for this area - the area-scoped version wins and the shared one is
// left out, never both. `codes` is expected to be the raw, unfiltered "every active code as
// stored" list (GET /shift-codes with no staffArea) - this function does the same resolution the
// backend would for that one area, so a picker scoped to one employee's area sees shared codes
// too, not just the ones explicitly defined for that area.
export function resolveShiftCodesForArea(codes: ShiftCode[], area: StaffArea): ShiftCode[] {
  const areaScoped = codes.filter((c) => c.staffArea === area);
  const areaScopedCodeStrings = new Set(areaScoped.map((c) => c.code));
  const shared = codes.filter((c) => c.staffArea === null && !areaScopedCodeStrings.has(c.code));
  return [...areaScoped, ...shared];
}

export const WEEKDAY_LABELS: Record<Weekday, string> = {
  MONDAY: "Monday",
  TUESDAY: "Tuesday",
  WEDNESDAY: "Wednesday",
  THURSDAY: "Thursday",
  FRIDAY: "Friday",
  SATURDAY: "Saturday",
  SUNDAY: "Sunday",
};

// Pure drag-classification logic for the roster grid - kept out of RosterGrid.tsx so "which of
// the three drag meanings does this drop resolve to" is a testable rule, not something only
// eyeballed by dragging things around in a browser. Mirrors this app's convention of factoring
// pure display/gesture logic out of the grid component (calendarLayout.ts, spaGridLayout.ts,
// propertyMapDisplay.ts all do the same split).
//
// The three meanings, approved as proposed and carried over from the calendar/spa grids' own
// swap gesture: same employee + empty target = move (date changes); different employee + empty
// target = reassign (ownership changes, date does not - see RosterReassignInput's own backend
// description); different employee/date + an occupied target = swap. A drop that would require
// changing both the date AND the employee in one call has no single backend operation to express
// it (move only changes date, reassign only changes employee) - that's a miss, not a guess, same
// "a miss cancels" rule the calendar/spa grids already settled on for their own drags.

export type RosterDragSource = { entryId: string; employeeUserId: string; date: string };
export type RosterDropTargetEntry = { id: string; locked: boolean };
export type RosterDropTarget = { employeeUserId: string; date: string; entry: RosterDropTargetEntry | null };

// A locked entry is not a valid swap partner at all - not "a swap attempt that will be refused",
// the same way a cross-room-type bar is still a real (refused) swap target on the calendar. Here
// there's no partial-validity case to surface to the user mid-drag, so a locked cell simply never
// counts as hoverable, and never arms the sticky "cancel on a later miss" rule below.
export function isValidSwapTarget(source: RosterDragSource, target: RosterDropTarget): boolean {
  return target.entry !== null && target.entry.id !== source.entryId && !target.entry.locked;
}

export type RosterDropClassification =
  | { kind: "cancel" }
  | { kind: "move"; entryId: string; date: string }
  | { kind: "reassign"; entryId: string; employeeUserId: string }
  | { kind: "swap"; entryId: string; otherEntryId: string };

// `hasHoveredSwapTarget` is sticky state the caller accumulates across the whole drag gesture
// (true the moment isValidSwapTarget was ever true during this drag, never reset back to false
// until the drag ends) - not recomputed here, since this function only sees the final drop.
export function classifyRosterDrop(source: RosterDragSource, target: RosterDropTarget, hasHoveredSwapTarget: boolean): RosterDropClassification {
  if (isValidSwapTarget(source, target)) {
    return { kind: "swap", entryId: source.entryId, otherEntryId: target.entry!.id };
  }
  if (target.entry) return { kind: "cancel" }; // dropped on itself, or on a locked entry

  // Once a valid swap target was hovered at any point in this drag, it has committed to being a
  // swap attempt for the rest of the gesture - releasing on an empty cell now is a miss, and
  // cancels the whole thing rather than silently downgrading to a move or reassign.
  if (hasHoveredSwapTarget) return { kind: "cancel" };

  const sameEmployee = target.employeeUserId === source.employeeUserId;
  const sameDate = target.date === source.date;
  if (sameEmployee && sameDate) return { kind: "cancel" }; // dropped back where it started
  if (sameEmployee) return { kind: "move", entryId: source.entryId, date: target.date };
  if (sameDate) return { kind: "reassign", entryId: source.entryId, employeeUserId: target.employeeUserId };
  return { kind: "cancel" }; // diagonal drop - no single operation expresses "both change at once"
}
