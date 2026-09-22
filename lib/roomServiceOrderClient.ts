// Client for the authenticated room-service ordering screen (app/guest/room-service/page.tsx) —
// goes through /api/guest-proxy (the httpOnly guest-session cookie, forwarded server-side as
// Authorization: Bearer) rather than PUBLIC_PROXY_URL, unlike lib/guestOrderClient.ts's
// unauthenticated dine-in door: this is an account-gated action against a specific guest's own
// CHECKED_IN booking, not a per-order token anyone holding a QR code can use. Reuses
// GuestOrderView/GuestOrderItem from lib/guestOrderTypes.ts as-is - the backend's GuestOrderApi
// returns the exact same shape as PublicOrderingApi (see that schema's own openapi.yaml
// description), so there's nothing here worth a near-duplicate type for.
import { extractApiError } from "@/lib/apiError";
import type { OrderItemInput } from "@/lib/posTypes";
import type { GuestOrderView } from "@/lib/guestOrderTypes";

export type GuestResult<T> = { ok: true; data: T } | { ok: false; error: string; status: number };

async function guestProxyRequest<T>(path: string, init: RequestInit | undefined, fallbackError: string): Promise<GuestResult<T>> {
  let res: Response;
  try {
    res = await fetch(`/api/guest-proxy${path}`, { credentials: "include", cache: "no-store", ...init });
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

export function submitRoomServiceOrder(bookingId: string, items: OrderItemInput[]): Promise<GuestResult<GuestOrderView>> {
  return guestProxyRequest<GuestOrderView>(
    "/orders",
    { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ bookingId, items }) },
    "Could not place your order — try again."
  );
}

export function addRoomServiceOrderItems(orderId: string, items: OrderItemInput[]): Promise<GuestResult<GuestOrderView>> {
  return guestProxyRequest<GuestOrderView>(
    `/orders/${orderId}/items`,
    { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(items) },
    "Could not add that to your order — try again."
  );
}

export function fetchRoomServiceOrder(orderId: string): Promise<GuestResult<GuestOrderView>> {
  return guestProxyRequest<GuestOrderView>(`/orders/${orderId}`, undefined, "Could not load your order.");
}
