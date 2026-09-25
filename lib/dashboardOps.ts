import { backendJson } from "@/lib/backendServer";
import { BackendError } from "@/lib/backend";
import { isStale } from "@/lib/attendanceDeviceHealth";
import type { AttendanceDevice, MaintenanceTask, RosterCoverageWarning, RosterMonth, TodayShiftStatus } from "@/lib/types";

// Dashboard blocks beyond the money figures in adminStats.ts - each one reuses an endpoint an
// existing screen already reads, no new aggregation on the backend. Same three-outcome shape as
// DashboardPosSummary, per block, for the same reason: each has its own role floor (the staff
// reads are MANAGER+, maintenance is any signed-in user), and a 403 on one must hide just that
// block, not fail the whole page.
export type DashboardBlock<T> = { status: "ok"; data: T } | { status: "forbidden" } | { status: "error" };

async function load<T, R>(path: string, compute: (raw: T) => R): Promise<DashboardBlock<R>> {
  try {
    const raw = await backendJson<T>(path, { auth: true });
    return { status: "ok", data: compute(raw) };
  } catch (e) {
    if (e instanceof BackendError && e.status === 403) return { status: "forbidden" };
    return { status: "error" };
  }
}

export type ShiftBoardSummary = { onShift: number; late: number; missed: number; scheduledToday: number };

// Counts from GET /attendance/today (the same feed as the roster page's Today tab). Only employees
// with a working roster entry today appear there at all, so scheduledToday is "rostered today".
export function summarizeShiftBoard(statuses: TodayShiftStatus[]): ShiftBoardSummary {
  return {
    onShift: statuses.filter((s) => s.state === "ON_SHIFT").length,
    late: statuses.filter((s) => s.state === "LATE").length,
    missed: statuses.filter((s) => s.state === "MISSED").length,
    scheduledToday: statuses.length,
  };
}

// The roster month's coverage warnings, narrowed to one date - the same data RosterGrid marks per
// day column.
export function coverageWarningsOn(warnings: RosterCoverageWarning[], dateKey: string): RosterCoverageWarning[] {
  return warnings.filter((w) => w.date === dateKey);
}

export type DeviceHealthSummary = { active: number; quiet: { name: string; neverReached: boolean }[] };

// Only active devices count - an inactive one is deliberately not polled, so its silence means
// nothing. Same staleness rule as the attendance-devices screen itself.
export function summarizeDeviceHealth(devices: AttendanceDevice[], nowMs: number): DeviceHealthSummary {
  const active = devices.filter((d) => d.active);
  return {
    active: active.length,
    quiet: active.filter((d) => isStale(d.lastSeenAt, nowMs)).map((d) => ({ name: d.name, neverReached: d.lastSeenAt === null })),
  };
}

export type MaintenanceSummary = { open: number; inProgress: number; blockingRooms: number };

export function summarizeMaintenance(tasks: MaintenanceTask[]): MaintenanceSummary {
  const notDone = tasks.filter((t) => t.status !== "DONE");
  return {
    open: notDone.filter((t) => t.status === "OPEN").length,
    inProgress: notDone.filter((t) => t.status === "IN_PROGRESS").length,
    blockingRooms: notDone.filter((t) => t.blockId !== null).length,
  };
}

// The hotel's own calendar date (Asia/Bangkok), not the Next server's ambient zone or UTC -
// coverage warnings are keyed by the roster's local date.
export function hotelDateKey(now: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok" }).format(now);
}

export async function getDashboardOps() {
  const now = new Date();
  const todayKey = hotelDateKey(now);
  const [year, month] = todayKey.split("-").map(Number);

  const [shiftBoard, coverage, devices, maintenance] = await Promise.all([
    load<TodayShiftStatus[], ShiftBoardSummary>("/attendance/today", summarizeShiftBoard),
    load<RosterMonth, RosterCoverageWarning[]>(`/roster?year=${year}&month=${month}`, (m) => coverageWarningsOn(m.coverageWarnings, todayKey)),
    load<AttendanceDevice[], DeviceHealthSummary>("/attendance/devices", (d) => summarizeDeviceHealth(d, now.getTime())),
    load<MaintenanceTask[], MaintenanceSummary>("/maintenance-tasks", summarizeMaintenance),
  ]);

  return { shiftBoard, coverage, devices, maintenance };
}
