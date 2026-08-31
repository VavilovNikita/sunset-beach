import { posRequest, posJsonInit, type PosResult } from "@/lib/pos/posFetch";
import type { Shift, ShiftCloseInput, ShiftOpenInput, ShiftSummary } from "@/lib/posTypes";

// GET /shifts/current 404s when the caller has no open shift right now — that's a real, expected
// outcome (not every visit to the shift screen happens mid-shift), so it's folded into the result
// as `data: null` rather than treated as an error. Branches on the real HTTP status, not the
// error text, so a future wording change on the backend can't silently break this check.
export async function fetchCurrentShift(): Promise<PosResult<ShiftSummary | null>> {
  const result = await posRequest<ShiftSummary>("/shifts/current", undefined, "Could not check shift status.");
  if (!result.ok && result.status === 404) return { ok: true, data: null, status: 404 };
  return result;
}

export function fetchShift(id: string): Promise<PosResult<ShiftSummary>> {
  return posRequest<ShiftSummary>(`/shifts/${id}`, undefined, "Could not load this shift.");
}

export function openShift(input: ShiftOpenInput): Promise<PosResult<Shift>> {
  return posRequest<Shift>("/shifts/open", posJsonInit("POST", input), "Could not open a shift.");
}

export function closeShift(id: string, input: ShiftCloseInput): Promise<PosResult<Shift>> {
  return posRequest<Shift>(`/shifts/${id}/close`, posJsonInit("POST", input), "Could not close this shift.");
}
