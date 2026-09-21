// Client for the unauthenticated dine-in QR ordering page (app/order/[orderId]/page.tsx) —
// same shape as lib/pos/posFetch.ts's posRequest (a thrown fetch gets its own message, distinct
// from a real non-2xx response, and the caller always gets a settled result), but through
// PUBLIC_PROXY_URL with no session cookie, same as lib/publicQuoteClient.ts. Every call here is
// gated by `token` alone on the backend (OrderService#requireGuestAccess) — there's no
// Authorization header to attach.
import { PUBLIC_PROXY_URL } from "@/lib/backend";
import { extractApiError } from "@/lib/apiError";
import type { MenuItem, OrderItemInput } from "@/lib/posTypes";
import type { GuestOrderView } from "@/lib/guestOrderTypes";

export type GuestResult<T> = { ok: true; data: T } | { ok: false; error: string; status: number };

async function guestRequest<T>(path: string, init: RequestInit | undefined, fallbackError: string): Promise<GuestResult<T>> {
  let res: Response;
  try {
    res = await fetch(`${PUBLIC_PROXY_URL}${path}`, { cache: "no-store", ...init });
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
  return { ok: true, data: body as T };
}

export function fetchGuestMenu(): Promise<GuestResult<MenuItem[]>> {
  return guestRequest<MenuItem[]>("/public/menu", undefined, "Could not load the menu.");
}

export function fetchGuestOrder(orderId: string, token: string): Promise<GuestResult<GuestOrderView>> {
  return guestRequest<GuestOrderView>(
    `/public/orders/${orderId}?token=${encodeURIComponent(token)}`,
    undefined,
    "Could not load your order. The QR code may no longer be valid."
  );
}

export function addGuestOrderItems(orderId: string, token: string, items: OrderItemInput[]): Promise<GuestResult<GuestOrderView>> {
  return guestRequest<GuestOrderView>(
    `/public/orders/${orderId}/items?token=${encodeURIComponent(token)}`,
    { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(items) },
    "Could not add that to your order — try again."
  );
}
