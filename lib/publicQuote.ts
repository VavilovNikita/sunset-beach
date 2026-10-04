import { headers } from "next/headers";
import { backendFetch } from "@/lib/backendServer";
import { QUOTE_FALLBACK_ERROR, quotePath, toQuoteResult, type QuoteResult } from "@/lib/quote";

// Server-side GET /public/rooms/{id}/quote for the booking pages' first render. The backend rate
// limits this endpoint per caller address, so the visitor's address is passed on (see
// clientIpHeaders) - otherwise every visitor's page views would land in one shared bucket keyed
// on this Next.js server's own address. Never throws; see QuoteResult.
export async function getRoomQuote(roomId: string, checkIn: string, checkOut: string): Promise<QuoteResult> {
  try {
    const res = await backendFetch(quotePath(roomId, checkIn, checkOut), { headers: await clientIpHeaders() });
    return await toQuoteResult(res);
  } catch {
    return { ok: false, status: null, message: QUOTE_FALLBACK_ERROR };
  }
}

// X-Real-IP is set (overwritten, never appended to) by the host nginx in front of this app - see
// nginx/conf.d/app.conf - so unlike the X-Forwarded-For nginx builds with
// $proxy_add_x_forwarded_for, a visitor can't choose its value. Sent on to sunset as
// X-Forwarded-For, which is what its ClientIpResolver reads. Absent (local dev, no nginx), nothing
// is forwarded and sunset falls back to the connection's own address, as before.
export async function clientIpHeaders(): Promise<Record<string, string>> {
  const ip = (await headers()).get("x-real-ip");
  return ip ? { "X-Forwarded-For": ip } : {};
}
