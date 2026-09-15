// Shared client-side calls for /attendance/devices (components/admin/AttendanceDeviceManager.tsx).
// Mirrors lib/printerClient.ts exactly - same physical-networked-device CRUD shape.
import { adminRequest, adminJsonInit } from "@/lib/adminFetch";
import type { AttendanceDevice, AttendanceDeviceInput } from "@/lib/types";

export type SaveAttendanceDeviceResult = { ok: true; device: AttendanceDevice } | { ok: false; error: string };

export async function createAttendanceDevice(input: AttendanceDeviceInput): Promise<SaveAttendanceDeviceResult> {
  const result = await adminRequest<AttendanceDevice>("/attendance/devices", adminJsonInit("POST", input), "Could not register the device.");
  if (!result.ok) return { ok: false, error: result.error };
  return { ok: true, device: result.data };
}

// PATCH is a full replace on this API, same as PrinterManager.
export async function updateAttendanceDevice(id: string, input: AttendanceDeviceInput): Promise<SaveAttendanceDeviceResult> {
  const result = await adminRequest<AttendanceDevice>(`/attendance/devices/${id}`, adminJsonInit("PATCH", input), "Could not save the device.");
  if (!result.ok) return { ok: false, error: result.error };
  return { ok: true, device: result.data };
}

// Forces a full re-read regardless of the device's usual windowed poll - see the backend's
// POST /attendance/devices/{id}/resync doc. Returns 200 either way; whether it actually reached
// the device is read off the returned lastSeenAt, not a separate success flag.
export async function resyncAttendanceDevice(id: string): Promise<SaveAttendanceDeviceResult> {
  const result = await adminRequest<AttendanceDevice>(`/attendance/devices/${id}/resync`, adminJsonInit("POST"), "Could not reach the device.");
  if (!result.ok) return { ok: false, error: result.error };
  return { ok: true, device: result.data };
}
