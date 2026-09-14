// Shared client-side calls for the staff roster module (shift codes, patterns, the roster grid
// and its editing, coverage rules, attendance, pay rates, the actuals export) - mirrors
// lib/maintenanceTaskClient.ts's exact pattern (adminRequest + adminJsonInit for JSON bodies).
// All of this is MANAGER+ on the backend except listShiftCodes and getMyRoster, which any
// authenticated staff member may call - see each function's own comment.
import { adminRequest, adminJsonInit } from "@/lib/adminFetch";
import { ADMIN_API_URL } from "@/lib/backend";
import { extractApiError } from "@/lib/apiError";
import type {
  AttendanceDaySummary,
  AttendancePunch,
  AttendancePunchCreateInput,
  EmployeePattern,
  EmployeePatternInput,
  EmployeePayRate,
  EmployeePayRateCreateInput,
  RosterEmployee,
  RosterEntry,
  RosterEntryCreateInput,
  RosterMonth,
  RosterMoveInput,
  RosterReassignInput,
  RosterSwapInput,
  ShiftCode,
  ShiftCodeCreateInput,
  StaffArea,
  StaffAreaCoverageRule,
  StaffAreaCoverageRuleInput,
} from "@/lib/types";

type Result<T> = { ok: true; data: T } | { ok: false; error: string };

// Any authenticated staff member - an employee reading their own schedule needs to know what "9"
// or "PH" means as much as a manager building the grid does.
export async function listShiftCodes(staffArea?: StaffArea): Promise<Result<ShiftCode[]>> {
  const query = staffArea ? `?staffArea=${staffArea}` : "";
  const result = await adminRequest<ShiftCode[]>(`/shift-codes${query}`, undefined, "Could not load shift codes.");
  if (!result.ok) return { ok: false, error: result.error };
  return { ok: true, data: result.data };
}

export async function createShiftCode(input: ShiftCodeCreateInput): Promise<Result<ShiftCode>> {
  const result = await adminRequest<ShiftCode>("/shift-codes", adminJsonInit("POST", input), "Could not save this shift code.");
  if (!result.ok) return { ok: false, error: result.error };
  return { ok: true, data: result.data };
}

export async function listEmployeePatterns(): Promise<Result<EmployeePattern[]>> {
  const result = await adminRequest<EmployeePattern[]>("/employee-patterns", undefined, "Could not load employee patterns.");
  if (!result.ok) return { ok: false, error: result.error };
  return { ok: true, data: result.data };
}

export async function setEmployeePattern(employeeUserId: string, input: EmployeePatternInput): Promise<Result<EmployeePattern>> {
  const result = await adminRequest<EmployeePattern>(
    `/employee-patterns/${employeeUserId}`,
    adminJsonInit("PUT", input),
    "Could not save this employee's pattern."
  );
  if (!result.ok) return { ok: false, error: result.error };
  return { ok: true, data: result.data };
}

export async function listRosterEmployees(): Promise<Result<RosterEmployee[]>> {
  const result = await adminRequest<RosterEmployee[]>("/roster/employees", undefined, "Could not load employees.");
  if (!result.ok) return { ok: false, error: result.error };
  return { ok: true, data: result.data };
}

export async function getRosterMonth(year: number, month: number): Promise<Result<RosterMonth>> {
  const result = await adminRequest<RosterMonth>(`/roster?year=${year}&month=${month}`, undefined, "Could not load the roster.");
  if (!result.ok) return { ok: false, error: result.error };
  return { ok: true, data: result.data };
}

// Any authenticated staff member - their own entries only, read-only.
export async function getMyRoster(year: number, month: number): Promise<Result<RosterEntry[]>> {
  const result = await adminRequest<RosterEntry[]>(`/roster/me?year=${year}&month=${month}`, undefined, "Could not load your schedule.");
  if (!result.ok) return { ok: false, error: result.error };
  return { ok: true, data: result.data };
}

export async function generateRosterMonth(year: number, month: number): Promise<Result<RosterMonth>> {
  const result = await adminRequest<RosterMonth>(`/roster/generate?year=${year}&month=${month}`, adminJsonInit("POST"), "Could not generate this month.");
  if (!result.ok) return { ok: false, error: result.error };
  return { ok: true, data: result.data };
}

export async function createRosterEntry(input: RosterEntryCreateInput): Promise<Result<RosterEntry>> {
  const result = await adminRequest<RosterEntry>("/roster/entries", adminJsonInit("POST", input), "Could not assign this shift.");
  if (!result.ok) return { ok: false, error: result.error };
  return { ok: true, data: result.data };
}

export async function deleteRosterEntry(id: string): Promise<Result<true>> {
  const result = await adminRequest<{ ok: boolean }>(`/roster/entries/${id}`, { method: "DELETE" }, "Could not remove this shift.");
  if (!result.ok) return { ok: false, error: result.error };
  return { ok: true, data: true };
}

export async function moveRosterEntry(id: string, input: RosterMoveInput): Promise<Result<RosterEntry>> {
  const result = await adminRequest<RosterEntry>(`/roster/entries/${id}/date`, adminJsonInit("PATCH", input), "Could not move this shift.");
  if (!result.ok) return { ok: false, error: result.error };
  return { ok: true, data: result.data };
}

export async function reassignRosterEntry(id: string, input: RosterReassignInput): Promise<Result<RosterEntry>> {
  const result = await adminRequest<RosterEntry>(`/roster/entries/${id}/employee`, adminJsonInit("PATCH", input), "Could not reassign this shift.");
  if (!result.ok) return { ok: false, error: result.error };
  return { ok: true, data: result.data };
}

export async function swapRosterEntries(id: string, input: RosterSwapInput): Promise<Result<RosterEntry>> {
  const result = await adminRequest<RosterEntry>(`/roster/entries/${id}/swap`, adminJsonInit("POST", input), "Could not swap these shifts.");
  if (!result.ok) return { ok: false, error: result.error };
  return { ok: true, data: result.data };
}

export async function setRosterEntryLocked(id: string, locked: boolean): Promise<Result<RosterEntry>> {
  const result = await adminRequest<RosterEntry>(`/roster/entries/${id}/lock`, adminJsonInit("PATCH", { locked }), "Could not change the lock.");
  if (!result.ok) return { ok: false, error: result.error };
  return { ok: true, data: result.data };
}

export async function listStaffAreaCoverageRules(): Promise<Result<StaffAreaCoverageRule[]>> {
  const result = await adminRequest<StaffAreaCoverageRule[]>("/staff-area-coverage-rules", undefined, "Could not load coverage rules.");
  if (!result.ok) return { ok: false, error: result.error };
  return { ok: true, data: result.data };
}

export async function setStaffAreaCoverageRule(staffArea: StaffArea, input: StaffAreaCoverageRuleInput): Promise<Result<StaffAreaCoverageRule>> {
  const result = await adminRequest<StaffAreaCoverageRule>(
    `/staff-area-coverage-rules/${staffArea}`,
    adminJsonInit("PUT", input),
    "Could not save this coverage rule."
  );
  if (!result.ok) return { ok: false, error: result.error };
  return { ok: true, data: result.data };
}

export async function listAttendancePunches(employeeUserId: string, from: string, to: string): Promise<Result<AttendancePunch[]>> {
  const result = await adminRequest<AttendancePunch[]>(
    `/attendance?employeeUserId=${employeeUserId}&from=${from}&to=${to}`,
    undefined,
    "Could not load attendance."
  );
  if (!result.ok) return { ok: false, error: result.error };
  return { ok: true, data: result.data };
}

export async function recordAttendancePunch(input: AttendancePunchCreateInput): Promise<Result<AttendancePunch>> {
  const result = await adminRequest<AttendancePunch>("/attendance", adminJsonInit("POST", input), "Could not record this punch.");
  if (!result.ok) return { ok: false, error: result.error };
  return { ok: true, data: result.data };
}

export async function getAttendanceSummary(employeeUserId: string, year: number, month: number): Promise<Result<AttendanceDaySummary[]>> {
  const result = await adminRequest<AttendanceDaySummary[]>(
    `/attendance/summary?employeeUserId=${employeeUserId}&year=${year}&month=${month}`,
    undefined,
    "Could not load the attendance summary."
  );
  if (!result.ok) return { ok: false, error: result.error };
  return { ok: true, data: result.data };
}

export async function listEmployeePayRates(employeeUserId: string): Promise<Result<EmployeePayRate[]>> {
  const result = await adminRequest<EmployeePayRate[]>(`/employee-pay-rates?employeeUserId=${employeeUserId}`, undefined, "Could not load pay rate history.");
  if (!result.ok) return { ok: false, error: result.error };
  return { ok: true, data: result.data };
}

export async function createEmployeePayRate(input: EmployeePayRateCreateInput): Promise<Result<EmployeePayRate>> {
  const result = await adminRequest<EmployeePayRate>("/employee-pay-rates", adminJsonInit("POST", input), "Could not save this rate.");
  if (!result.ok) return { ok: false, error: result.error };
  return { ok: true, data: result.data };
}

// Not JSON (the backend returns text/csv), so this bypasses adminRequest and reads the body as
// text directly - same ADMIN_API_URL origin, same credentials:"include", same extractApiError
// handling on failure (the admin-proxy route still returns a JSON ErrorMessage body on a non-2xx
// status, since that path is only hit on a genuine error, never on the CSV success response).
export async function exportRosterActualsCsv(year: number, month: number): Promise<Result<string>> {
  let res: Response;
  try {
    res = await fetch(`${ADMIN_API_URL}/roster/actuals-export?year=${year}&month=${month}`, { credentials: "include" });
  } catch {
    return { ok: false, error: "No connection — check the network and try again." };
  }
  if (!res.ok) {
    const data = await res.json().catch(() => null);
    return { ok: false, error: extractApiError(data, "Could not export this month.") };
  }
  return { ok: true, data: await res.text() };
}
