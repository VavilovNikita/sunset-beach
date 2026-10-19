import type { JobFunction, Role } from "@/lib/session";

// The roster page serves two kinds of reader. A MANAGER+ gets every tab and every edit. The HR director
// (the HR job function, any role below MANAGER) gets what the backend lets them READ - the month's grid
// (`GET /roster`, `/roster/employees`) and the attendance summary (`GET /attendance/summary`) - and nothing
// that writes. Showing a tab whose first request is a 403 would be a working-looking page that fails, so the
// others are not offered, and the page itself checks (the sidebar link is not access control).

export const ROSTER_TABS = [
  { key: "grid", label: "Grid", hrReadable: true },
  { key: "codes", label: "Shift codes", hrReadable: false },
  { key: "patterns", label: "Patterns", hrReadable: false },
  { key: "coverage", label: "Coverage", hrReadable: false },
  { key: "today", label: "Today", hrReadable: false },
  { key: "attendance", label: "Attendance", hrReadable: true },
  { key: "payrates", label: "Pay rates", hrReadable: false },
] as const;

export type RosterTabKey = (typeof ROSTER_TABS)[number]["key"];

export function canEditRoster(role: Role): boolean {
  return role === "MANAGER" || role === "ADMIN";
}

export function canOpenRoster(role: Role, functions: readonly JobFunction[]): boolean {
  return canEditRoster(role) || functions.includes("HR");
}

export function visibleRosterTabs(role: Role): readonly (typeof ROSTER_TABS)[number][] {
  return canEditRoster(role) ? ROSTER_TABS : ROSTER_TABS.filter((t) => t.hrReadable);
}

// An unknown or not-offered tab falls back to the grid, which every reader has.
export function parseRosterTab(raw: string | undefined, role: Role): RosterTabKey {
  return visibleRosterTabs(role).find((t) => t.key === raw)?.key ?? "grid";
}
