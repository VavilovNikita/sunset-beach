import { describe, expect, it } from "vitest";
import { coverageWarningsOn, hotelDateKey, summarizeDeviceHealth, summarizeMaintenance } from "./dashboardOps";
import type { AttendanceDevice, MaintenanceTask } from "./types";

const NOW_MS = Date.UTC(2026, 8, 25, 10, 0, 0);

function device(overrides: Partial<AttendanceDevice>): AttendanceDevice {
  return {
    id: "d1",
    name: "Back office",
    serial: "S1",
    address: "192.168.1.50",
    port: 4370,
    timezone: "Asia/Bangkok",
    active: true,
    lastSeenAt: new Date(NOW_MS - 5 * 60_000).toISOString(),
    windowedReadUnsupported: false,
    createdAt: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

function task(overrides: Partial<MaintenanceTask>): MaintenanceTask {
  return {
    id: "t1",
    roomUnitId: "u1",
    roomId: "r1",
    roomName: "Villa",
    unitLabel: "101",
    description: "Leak",
    status: "OPEN",
    blockId: null,
    reportedByUserId: "user-1",
    reportedByEmail: "a@example.com",
    photos: [],
    createdAt: "2026-09-01T00:00:00Z",
    closedAt: null,
    ...overrides,
  };
}

describe("hotelDateKey", () => {
  // 2026-09-25 18:30 UTC is already 2026-09-26 01:30 in Bangkok - the dashboard must use the
  // hotel's date for "today", not UTC.
  it("uses the Asia/Bangkok calendar date, not UTC", () => {
    expect(hotelDateKey(new Date(Date.UTC(2026, 8, 25, 18, 30)))).toBe("2026-09-26");
  });
});

describe("coverageWarningsOn", () => {
  it("keeps only the given date's warnings", () => {
    const warnings = [
      { staffArea: "KITCHEN" as const, date: "2026-09-25", workingCount: 1, minimumWorking: 2 },
      { staffArea: "KITCHEN" as const, date: "2026-09-26", workingCount: 0, minimumWorking: 2 },
    ];
    expect(coverageWarningsOn(warnings, "2026-09-25")).toEqual([warnings[0]]);
  });
});

describe("summarizeDeviceHealth", () => {
  it("flags active devices that are never reached or silent over 24h, and ignores inactive ones", () => {
    const summary = summarizeDeviceHealth(
      [
        device({ id: "ok" }),
        device({ id: "never", name: "Kitchen", lastSeenAt: null }),
        device({ id: "silent", name: "Gate", lastSeenAt: new Date(NOW_MS - 25 * 3_600_000).toISOString() }),
        device({ id: "retired", name: "Old", active: false, lastSeenAt: null }),
      ],
      NOW_MS
    );
    expect(summary.active).toBe(3);
    expect(summary.quiet).toEqual([
      { name: "Kitchen", neverReached: true },
      { name: "Gate", neverReached: false },
    ]);
  });
});

describe("summarizeMaintenance", () => {
  it("counts only unfinished tasks", () => {
    const summary = summarizeMaintenance([
      task({ id: "a", status: "OPEN" }),
      task({ id: "b", status: "IN_PROGRESS", blockId: "blk" }),
      task({ id: "c", status: "DONE", blockId: "blk2" }),
    ]);
    expect(summary).toEqual({ open: 1, inProgress: 1, blockingRooms: 1 });
  });
});
