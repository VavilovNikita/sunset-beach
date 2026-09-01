// Shared request helper for admin Client Components that write data — mirrors
// lib/pos/posFetch.ts's posRequest exactly (same result shape, same "No connection" wording),
// kept as its own file rather than imported from lib/pos/ so the two surfaces stay decoupled
// (lib/pos/* is /pos-specific by convention; nothing there is imported outside it today).
//
// Before this existed, every admin write (components/admin/pos/*, components/admin/
// BookingCardPanel.tsx, lib/bookingScheduleClient.ts and friends) called fetch() directly and
// only checked `!res.ok` — a thrown fetch (network drop, DNS failure, timeout) was never caught,
// so it propagated as an unhandled rejection: a "Sending…"/"Closing…" button stayed stuck forever
// with nothing on screen telling staff what happened, and in a couple of spots (RoomChargeLink's
// booking list, OrderTicket's cancel) a failed request was silently swallowed into an empty-but-
// plausible-looking state instead. Worst on money-moving actions (closing a POS order, charging a
// room), where a silent failure reads as a completed payment. Routing those calls through here
// gives every admin write the same explicit, visible failure the /pos section already had.
import { ADMIN_API_URL } from "@/lib/backend";
import { extractApiError } from "@/lib/apiError";

export type AdminResult<T> = { ok: true; data: T; status: number } | { ok: false; error: string; status: number };

export async function adminRequest<T>(path: string, init: RequestInit | undefined, fallbackError: string): Promise<AdminResult<T>> {
  let res: Response;
  try {
    res = await fetch(`${ADMIN_API_URL}${path}`, { credentials: "include", ...init });
  } catch {
    return { ok: false, error: "No connection — check the network and try again.", status: 0 };
  }

  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    if (!res.ok) return { ok: false, error: fallbackError, status: res.status };
  }

  if (!res.ok) return { ok: false, error: extractApiError(body, fallbackError), status: res.status };
  return { ok: true, data: body as T, status: res.status };
}

export function adminJsonInit(method: string, body?: unknown): RequestInit {
  return {
    method,
    headers: body !== undefined ? { "Content-Type": "application/json" } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  };
}
