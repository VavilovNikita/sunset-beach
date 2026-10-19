import { formatDate } from "@/lib/formatDate";
import type { JobFunction, Role } from "@/lib/session";
import type { HrVacationInput, ShiftChangeRequest, ShiftChangeRequestStatus, ShiftChangeRequestType, ShiftRequestCoverage, ShiftRequestDeciders } from "@/lib/types";

// Pure logic of the shift-request screens and of who may see what around them. The server is the
// authority on every rule here (who decides, whether a request still applies, the coverage figures);
// this only decides what to show and spares a round trip.

export const MAX_COMMENT_LENGTH = 300;

// A real calendar day written YYYY-MM-DD (2026-02-30 is not one). Round-trips through UTC so no zone can move it.
export function isValidDateKey(key: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) return false;
  const [y, m, d] = key.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

export const REQUEST_TYPE_LABELS: Record<ShiftChangeRequestType, string> = {
  MOVE: "Move",
  DELETE: "Day off",
};

export const REQUEST_STATUS_LABELS: Record<ShiftChangeRequestStatus, string> = {
  PENDING: "Waiting",
  APPROVED: "Approved",
  REJECTED: "Rejected",
  CANCELLED: "Withdrawn",
  EXPIRED: "Expired",
};

export const REQUEST_STATUSES = Object.keys(REQUEST_STATUS_LABELS) as ShiftChangeRequestStatus[];

// Colour meanings from CLAUDE.md: amber-400 = attention but not urgent (waiting), green-600 = done,
// coral = needs intervention (rejected, expired with nothing applied), neutral for a withdrawn one.
export function requestStatusClass(status: ShiftChangeRequestStatus): string {
  switch (status) {
    case "PENDING":
      return "text-amber-400 border-amber-400/40";
    case "APPROVED":
      return "text-green-600 border-green-600/40";
    case "REJECTED":
    case "EXPIRED":
      return "text-coral border-coral/40";
    case "CANCELLED":
      return "text-cream/60 border-cream/20";
  }
}

// "Move 20 May 2026 (N1 09:00-18:00) to 22 May 2026" / "Day off 20 May 2026 (N1 09:00-18:00)".
export function requestHeadline(r: Pick<ShiftChangeRequest, "type" | "shiftDate" | "shiftCode" | "shiftTimes" | "targetDate">): string {
  const shift = r.shiftTimes ? `${r.shiftCode} ${r.shiftTimes}` : r.shiftCode;
  if (r.type === "MOVE" && r.targetDate) return `Move ${formatDate(r.shiftDate)} (${shift}) to ${formatDate(r.targetDate)}`;
  return `Day off ${formatDate(r.shiftDate)} (${shift})`;
}

export type CoverageSentence = { text: string; warn: boolean };

// One sentence per day concerned. A day below the minimum is flagged (coral on screen) - the server
// never blocks on it, so neither does the screen.
export function coverageSentences(coverage: ShiftRequestCoverage | undefined, areaLabel: (area: ShiftRequestCoverage["staffArea"]) => string): CoverageSentence[] {
  if (!coverage) return [];
  const line = (date: string, working: number): CoverageSentence => ({
    text: `${areaLabel(coverage.staffArea)}: ${working} would work on ${formatDate(date)} (minimum ${coverage.minimumWorking})`,
    warn: working < coverage.minimumWorking,
  });
  const lines = [line(coverage.sourceDate, coverage.sourceWorkingAfter)];
  if (coverage.targetDate !== undefined && coverage.targetWorkingAfter !== undefined) lines.push(line(coverage.targetDate, coverage.targetWorkingAfter));
  return lines;
}

// Approve / Reject appear only for a waiting request the caller may decide. A MANAGER+ who is not
// one of today's deciders sees the request without buttons.
export function showDecisionButtons(r: Pick<ShiftChangeRequest, "status" | "callerMayDecide">): boolean {
  return r.status === "PENDING" && r.callerMayDecide;
}

// The line under a settled request: who and when, and the comment.
export function decisionLine(r: ShiftChangeRequest, formatMoment: (iso: string) => string): string | null {
  if (r.status === "PENDING") return null;
  if (r.status === "EXPIRED") return r.expiredReason ?? "Expired.";
  const when = r.decidedAt ? ` · ${formatMoment(r.decidedAt)}` : "";
  const who = r.decidedByName ? ` by ${r.decidedByName}` : "";
  const label = r.status === "APPROVED" ? "Approved" : r.status === "REJECTED" ? "Rejected" : "Withdrawn";
  return `${label}${who}${when}`;
}

export function decisionCommentError(comment: string): string | null {
  return comment.trim().length > MAX_COMMENT_LENGTH ? `At most ${MAX_COMMENT_LENGTH} characters.` : null;
}

// ---- filters -----------------------------------------------------------------------------------

export type RequestFilters = {
  status: ShiftChangeRequestStatus | "";
  from: string; // hotel day of the SHIFT, YYYY-MM-DD, or ""
  to: string;
};

export function defaultRequestFilters(): RequestFilters {
  return { status: "PENDING", from: "", to: "" };
}

export function requestsQueryString(filters: RequestFilters): string {
  const params = new URLSearchParams();
  if (filters.status) params.set("status", filters.status);
  if (filters.from) params.set("from", filters.from);
  if (filters.to) params.set("to", filters.to);
  return params.toString();
}

// The server answers 400 for a backwards range; saying it first spares the round trip.
export function requestFiltersError(filters: RequestFilters): string | null {
  if (filters.from && filters.to && filters.from > filters.to) return "“From” must be on or before “To”.";
  return null;
}

export function waitingCount(requests: readonly ShiftChangeRequest[]): number {
  return requests.filter((r) => r.status === "PENDING").length;
}

// ---- the HR director's leave ---------------------------------------------------------------------

// Both dates or neither (neither clears the leave); the last day not before the first. Dates are the
// hotel's calendar days as typed in a date input.
export function vacationFormError(from: string, to: string): string | null {
  if (!from && !to) return null;
  if (!from || !to) return "Give both dates, or clear both to remove the leave.";
  if (!isValidDateKey(from) || !isValidDateKey(to)) return "Dates like 2026-11-03.";
  if (to < from) return "The last day can't be before the first.";
  return null;
}

export function vacationInput(from: string, to: string): HrVacationInput {
  return from && to ? { from, to } : {};
}

export function vacationChanged(from: string, to: string, saved: Pick<ShiftRequestDeciders, "vacationFrom" | "vacationTo">): boolean {
  return from !== (saved.vacationFrom ?? "") || to !== (saved.vacationTo ?? "");
}

// One sentence on who decides today - the answer to "who will see my request".
export function decidersSummary(d: ShiftRequestDeciders): string {
  if (d.effectiveDeciders.length === 0) {
    return d.hrName
      ? `${d.hrName} is away and the administrators are not set to cover - requests wait.`
      : "Nobody holds the HR function and the administrators are not set to cover - requests wait.";
  }
  if (d.hrName && !d.onVacationToday) return `${d.hrName} decides.`;
  const names = d.effectiveDeciders.join(", ");
  return d.hrName ? `${d.hrName} is on leave today - the administrators decide (${names}).` : `Nobody holds the HR function - the administrators decide (${names}).`;
}

// ---- who sees what ----------------------------------------------------------------------------------

// The role half of "MANAGER+ or the HR function": both the requests page and the roster read gate. HR is a
// job function, never a rung of the role ladder.
export function canReadShiftRequests(role: Role, functions: readonly JobFunction[]): boolean {
  return role === "MANAGER" || role === "ADMIN" || functions.includes("HR");
}

export function isManagerOrAbove(role: Role): boolean {
  return role === "MANAGER" || role === "ADMIN";
}
