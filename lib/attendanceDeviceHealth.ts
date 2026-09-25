// Shared by AttendanceDeviceManager (client) and the dashboard (server) - kept out of the
// "use client" component so a server component can call it directly.

// A device that's gone quiet this long looks, in the punch data alone, exactly like a stretch
// where nobody worked - same threshold the backend's own device-silence-warning-hours default
// uses, so a device is flagged before it becomes a payroll surprise, not after.
export const SILENCE_WARNING_HOURS = 24;

export function isStale(lastSeenAt: string | null, nowMs: number = Date.now()): boolean {
  if (lastSeenAt === null) return true;
  return nowMs - new Date(lastSeenAt).getTime() > SILENCE_WARNING_HOURS * 60 * 60 * 1000;
}
