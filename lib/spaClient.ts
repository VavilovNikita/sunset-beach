// Shared client-side calls for the spa module - GET /spa-appointments (the day's grid),
// GET /spa-appointments/therapists (the narrower therapist picker - see that endpoint's own
// backend doc for why it isn't just GET /users), POST /spa-appointments, and
// PATCH /spa-appointments/{id}/status. Same ok/error result shape as every other admin write
// client (see lib/adminFetch.ts).
import { adminRequest, adminJsonInit } from "@/lib/adminFetch";
import type {
  SpaAppointment,
  SpaAppointmentCreateInput,
  SpaAppointmentResult,
  SpaAppointmentScheduleInput,
  SpaAppointmentStatusUpdateInput,
  SpaSchedule,
  SpaTherapist,
} from "@/lib/posTypes";

export type SpaScheduleResult = { ok: true; schedule: SpaSchedule } | { ok: false; error: string };
export type SpaTherapistsResult = { ok: true; therapists: SpaTherapist[] } | { ok: false; error: string };
export type CreateSpaAppointmentResult = { ok: true; result: SpaAppointmentResult } | { ok: false; error: string };
export type UpdateSpaAppointmentStatusResult = { ok: true; appointment: SpaAppointment } | { ok: false; error: string };
// status carried alongside the error so a caller can tell a 409 (room/therapist conflict - the
// drag's own loser case) apart from any other failure without re-parsing the message text.
export type UpdateSpaAppointmentScheduleResult =
  | { ok: true; appointment: SpaAppointment }
  | { ok: false; error: string; status: number };

export async function getSpaSchedule(date: string): Promise<SpaScheduleResult> {
  const result = await adminRequest<SpaSchedule>(`/spa-appointments?date=${date}`, undefined, "Could not load the spa schedule.");
  if (!result.ok) return { ok: false, error: result.error };
  return { ok: true, schedule: result.data };
}

export async function listSpaTherapists(): Promise<SpaTherapistsResult> {
  const result = await adminRequest<SpaTherapist[]>("/spa-appointments/therapists", undefined, "Could not load therapists.");
  if (!result.ok) return { ok: false, error: result.error };
  return { ok: true, therapists: result.data };
}

export async function createSpaAppointment(input: SpaAppointmentCreateInput): Promise<CreateSpaAppointmentResult> {
  const result = await adminRequest<SpaAppointmentResult>("/spa-appointments", adminJsonInit("POST", input), "Could not book this appointment.");
  if (!result.ok) return { ok: false, error: result.error };
  return { ok: true, result: result.data };
}

export async function updateSpaAppointmentStatus(id: string, input: SpaAppointmentStatusUpdateInput): Promise<UpdateSpaAppointmentStatusResult> {
  const result = await adminRequest<SpaAppointment>(`/spa-appointments/${id}/status`, adminJsonInit("PATCH", input), "Could not update this appointment.");
  if (!result.ok) return { ok: false, error: result.error };
  return { ok: true, appointment: result.data };
}

export async function updateSpaAppointmentSchedule(
  id: string,
  input: SpaAppointmentScheduleInput
): Promise<UpdateSpaAppointmentScheduleResult> {
  const result = await adminRequest<SpaAppointment>(`/spa-appointments/${id}/schedule`, adminJsonInit("PATCH", input), "Could not move this appointment.");
  if (!result.ok) return { ok: false, error: result.error, status: result.status };
  return { ok: true, appointment: result.data };
}
