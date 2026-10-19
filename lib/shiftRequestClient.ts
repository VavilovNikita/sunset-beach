// Calls of the shift-request screens, all through adminRequest (same-origin proxy, a connection failure told
// apart from a refusal). First paint reads are done server-side with backendJson; these are the filters,
// the decisions and the saves.
import { adminRequest, adminJsonInit, type AdminResult } from "@/lib/adminFetch";
import { requestsQueryString, type RequestFilters } from "@/lib/shiftRequests";
import type {
  HrVacationInput,
  ShiftChangeDecisionInput,
  ShiftChangeRequest,
  ShiftRequestDeciders,
  StaffBotSettings,
  StaffBotSettingsUpdateInput,
} from "@/lib/types";

export function fetchShiftRequests(filters: RequestFilters): Promise<AdminResult<ShiftChangeRequest[]>> {
  const qs = requestsQueryString(filters);
  return adminRequest<ShiftChangeRequest[]>(`/shift-change-requests${qs ? `?${qs}` : ""}`, undefined, "Could not load the requests.");
}

// Deciding a request that someone else already settled is a 200 with the request as it now stands (idempotent
// on the server), so the screen shows the real status rather than an error.
export function decideShiftRequest(id: string, input: ShiftChangeDecisionInput): Promise<AdminResult<ShiftChangeRequest>> {
  return adminRequest<ShiftChangeRequest>(
    `/shift-change-requests/${encodeURIComponent(id)}/decision`,
    adminJsonInit("POST", input),
    "Could not record the decision."
  );
}

export function cancelShiftRequest(id: string): Promise<AdminResult<ShiftChangeRequest>> {
  return adminRequest<ShiftChangeRequest>(`/shift-change-requests/${encodeURIComponent(id)}/cancel`, adminJsonInit("POST"), "Could not withdraw the request.");
}

export function fetchShiftRequestDeciders(): Promise<AdminResult<ShiftRequestDeciders>> {
  return adminRequest<ShiftRequestDeciders>("/shift-change-requests/deciders", undefined, "Could not load who decides.");
}

export function saveHrVacation(input: HrVacationInput): Promise<AdminResult<ShiftRequestDeciders>> {
  return adminRequest<ShiftRequestDeciders>("/shift-change-requests/hr-vacation", adminJsonInit("PUT", input), "Could not save the leave.");
}

export function saveStaffBotSettings(input: StaffBotSettingsUpdateInput): Promise<AdminResult<StaffBotSettings>> {
  return adminRequest<StaffBotSettings>("/settings/staff-bot", adminJsonInit("PUT", input), "Could not save the bot settings.");
}
