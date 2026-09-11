// Shared client-side call for GET /availability/{roomId} - the room-type-scoped, per-unit
// month view AvailabilityManager.tsx renders. Routed through adminRequest rather than a bare
// fetch specifically so a failure here surfaces as an actual error, not silence: the raw fetch
// this replaced had no res.ok check and no catch, so a real backend error (or a dropped
// connection) fell through to `data.days ?? []` and rendered as an empty, all-quiet calendar -
// indistinguishable from "this room type genuinely has no availability data" - instead of any
// visible sign that the request had failed.
import { adminRequest } from "@/lib/adminFetch";
import type { AvailabilityResponse } from "@/lib/types";

export type FetchAvailabilityResult = { ok: true; days: AvailabilityResponse["days"] } | { ok: false; error: string };

export async function fetchAvailability(roomId: string, month: string): Promise<FetchAvailabilityResult> {
  const result = await adminRequest<AvailabilityResponse>(
    `/availability/${roomId}?month=${month}`,
    undefined,
    "Could not load availability."
  );
  if (!result.ok) return { ok: false, error: result.error };
  return { ok: true, days: result.data.days ?? [] };
}
