// Shared client-side calls for /guests. Mirrors lib/maintenanceTaskClient.ts's exact pattern —
// list (optional q filter via URLSearchParams), get-by-id, create, update, delete, all through
// adminRequest/adminJsonInit.
import { adminRequest, adminJsonInit } from "@/lib/adminFetch";
import type { Guest, GuestCreateInput, GuestDetail, GuestUpdateInput } from "@/lib/types";

export type SearchGuestsResult = { ok: true; guests: Guest[] } | { ok: false; error: string };
export type GetGuestResult = { ok: true; guest: GuestDetail } | { ok: false; error: string };
export type CreateGuestResult = { ok: true; guest: Guest } | { ok: false; error: string };
export type UpdateGuestResult = { ok: true; guest: Guest } | { ok: false; error: string };
export type DeleteGuestResult = { ok: true } | { ok: false; error: string };

// q blank/omitted returns every guest, newest first — same "no query means everything" precedent
// as GET /bookings?guestName=.
export async function searchGuests(q?: string): Promise<SearchGuestsResult> {
  const params = new URLSearchParams();
  if (q && q.trim()) params.set("q", q.trim());
  const query = params.toString();
  const result = await adminRequest<Guest[]>(`/guests${query ? `?${query}` : ""}`, undefined, "Could not search guests.");
  if (!result.ok) return { ok: false, error: result.error };
  return { ok: true, guests: result.data };
}

export async function getGuest(id: string): Promise<GetGuestResult> {
  const result = await adminRequest<GuestDetail>(`/guests/${id}`, undefined, "Could not load this guest.");
  if (!result.ok) return { ok: false, error: result.error };
  return { ok: true, guest: result.data };
}

export async function createGuest(input: GuestCreateInput): Promise<CreateGuestResult> {
  const result = await adminRequest<Guest>(`/guests`, adminJsonInit("POST", input), "Could not create this guest.");
  if (!result.ok) return { ok: false, error: result.error };
  return { ok: true, guest: result.data };
}

export async function updateGuest(id: string, input: GuestUpdateInput): Promise<UpdateGuestResult> {
  const result = await adminRequest<Guest>(`/guests/${id}`, adminJsonInit("PATCH", input), "Could not update this guest.");
  if (!result.ok) return { ok: false, error: result.error };
  return { ok: true, guest: result.data };
}

export async function deleteGuest(id: string): Promise<DeleteGuestResult> {
  const result = await adminRequest<unknown>(`/guests/${id}`, { method: "DELETE" }, "Could not delete this guest.");
  if (!result.ok) return { ok: false, error: result.error };
  return { ok: true };
}
