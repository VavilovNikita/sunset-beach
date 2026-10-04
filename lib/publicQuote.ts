import { headers } from "next/headers";
import { backendFetch } from "@/lib/backendServer";
import { forwardedIpHeaders } from "@/lib/clientIp";
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

// See lib/clientIp.ts for where the address comes from and why only X-Real-IP is trusted.
export async function clientIpHeaders(): Promise<Record<string, string>> {
  return forwardedIpHeaders(await headers());
}
