import type { CSSProperties } from "react";
import type { ShiftCode, StaffArea, Weekday } from "@/lib/types";

// --- Shift-kind visual scheme --------------------------------------------------------------
// Kind supplies the SHAPE cue (fill vs. hatch vs. outline vs. hollow) - see the frontend CLAUDE.md's
// Colour meanings section for the now-scoped exception that lets a shift code's own colour replace
// the neutral tone below. Where a code has no displayColor (most codes, and every code until an
// admin picks one), the original neutral scheme still applies exactly as before: a shift's start
// time places it on a lightness scale within the SAME neutral family an ordinary occupied cell
// already uses (ink2 is today's plain chip colour) - earliest lightest, latest darkest, one hue
// throughout. SPLIT hatches between two bands when unset - two positions on the neutral scale
// (its own two intervals' start times). OPEN_SCHEDULE (no fixed hours) is an outline instead of a
// fill; ABSENCE is hollow with a small glyph - the one place shape alone isn't enough, since an
// unfilled chip risks reading as an empty cell rather than a recorded day off.
//
// When displayColor IS set, every kind - including SPLIT/OPEN_SCHEDULE/ABSENCE - renders as a
// plain solid fill of that colour: no border, no hatch, no glyph. An admin picking a colour is
// choosing what the chip looks like, full stop; a hatch/outline/hollow-with-glyph on top of a
// deliberately chosen colour would just be three renderings fighting over the same cell.
//
// Shared (not local to RosterGrid.tsx) so the Today tab's own status board can render the exact
// same chip for a shift code, recognisable at a glance from the grid - one copy of "what does this
// code look like" rather than a second one drifting out of sync with the first.
const CHIP_DARK_HEX = "#153138"; // ink2 - today's ordinary occupied-cell chip colour
const CHIP_LIGHT_HEX = "#FBF6EC"; // cream - this app's own light neutral
const EARLIEST_MINUTES = 6 * 60; // 06:00 anchors the lightest end
const LATEST_MINUTES = 23 * 60; // 23:00 anchors the darkest end
const MAX_LIGHT_MIX = 0.55; // caps how far toward cream the lightest chip goes - stays a muted neutral, never literal cream

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function mixRgb(fromHex: string, toHex: string, amount: number): [number, number, number] {
  const [fr, fg, fb] = hexToRgb(fromHex);
  const [tr, tg, tb] = hexToRgb(toHex);
  const mix = (a: number, b: number) => Math.round(a + (b - a) * amount);
  return [mix(fr, tr), mix(fg, tg), mix(fb, tb)];
}

function rgbCss([r, g, b]: [number, number, number]) {
  return `rgb(${r}, ${g}, ${b})`;
}

// 0 (latest) to 1 (earliest), clamped to the anchor range - a real, continuous position, not a
// bucket, per the actual ask ("a shift falls naturally on a scale rather than into a set of
// labels").
function earlinessFor(time: string): number {
  const [h, m] = time.split(":").map(Number);
  const minutes = h * 60 + m;
  const t = (LATEST_MINUTES - minutes) / (LATEST_MINUTES - EARLIEST_MINUTES);
  return Math.max(0, Math.min(1, t));
}

function chipRgbFor(time: string): [number, number, number] {
  return mixRgb(CHIP_DARK_HEX, CHIP_LIGHT_HEX, earlinessFor(time) * MAX_LIGHT_MIX);
}

// Plain luminance check so text stays readable at both ends of the scale - the lightest chips
// need the app's own dark ink for text, not cream-on-cream. Also what auto-picks a chip's
// text/icon colour against an admin-chosen displayColor, so labels stay legible whatever they pick.
function contrastTextFor([r, g, b]: [number, number, number]) {
  const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
  return luminance > 150 ? "#0F262B" : "#FBF6EC";
}

export type ChipAppearance = { style: CSSProperties; textColor: string; glyph?: string };

// Null kind = a row that predates this field and hasn't been confirmed yet (see ShiftCode.kind's
// own comment) - today's plain bg-ink2/60 chip, unstyled here, until someone confirms one on the
// Shift codes screen. displayColor doesn't change that: there's nothing to recolour without a
// kind to say what shape it should take.
export function chipAppearanceFor(shiftCode: ShiftCode): ChipAppearance | null {
  const kind = shiftCode.kind;
  if (!kind) return null;
  const displayColor = shiftCode.displayColor;

  if (kind === "MORNING" || kind === "EVENING") {
    const rgb = displayColor ? hexToRgb(displayColor) : chipRgbFor(shiftCode.startTime1!);
    return { style: { backgroundColor: rgbCss(rgb) }, textColor: contrastTextFor(rgb) };
  }
  if (kind === "SPLIT") {
    if (displayColor) {
      const rgb = hexToRgb(displayColor);
      return { style: { backgroundColor: rgbCss(rgb) }, textColor: contrastTextFor(rgb) };
    }
    const [rgb1, rgb2] = [chipRgbFor(shiftCode.startTime1!), chipRgbFor(shiftCode.startTime2!)];
    return {
      style: { backgroundImage: `repeating-linear-gradient(45deg, ${rgbCss(rgb1)} 0px 6px, ${rgbCss(rgb2)} 6px 12px)` },
      textColor: contrastTextFor(rgb1),
    };
  }
  if (kind === "OPEN_SCHEDULE") {
    if (displayColor) {
      const rgb = hexToRgb(displayColor);
      return { style: { backgroundColor: rgbCss(rgb) }, textColor: contrastTextFor(rgb) };
    }
    return {
      style: { backgroundColor: "transparent", border: "1px solid rgba(251,246,236,0.5)" },
      textColor: "rgba(251,246,236,0.8)",
    };
  }
  // ABSENCE
  if (displayColor) {
    const rgb = hexToRgb(displayColor);
    return { style: { backgroundColor: rgbCss(rgb) }, textColor: contrastTextFor(rgb) };
  }
  return {
    style: { backgroundColor: "transparent", border: "1px dashed rgba(251,246,236,0.25)" },
    textColor: "rgba(251,246,236,0.45)",
    glyph: "–",
  };
}

// Display order for department groups - the roster grid and the Users page both group by this.
export const STAFF_AREAS: StaffArea[] = ["ADMIN", "FRONT_OFFICE", "MAINTENANCE", "HOUSEKEEPING", "RESTAURANT", "KITCHEN"];

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
