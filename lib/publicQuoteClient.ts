import { PUBLIC_PROXY_URL } from "@/lib/backend";
import { QUOTE_FALLBACK_ERROR, quotePath, toQuoteResult, type QuoteResult } from "@/lib/quote";

// Client-side counterpart to lib/publicQuote.ts's getRoomQuote: GET /public/rooms/{id}/quote
// through this app's own same-origin PUBLIC_PROXY_URL (same pattern BookingGuestForm uses for
// POST /bookings — see that route's comment for why a direct PUBLIC_BACKEND_URL fetch here used
// to be silently blocked by CSP) since backendFetch() needs next/headers and can't run
// client-side.
//
// Never throws: a network failure comes back as { ok: false, status: null }. A resolved quote
// with `available: false` is a legitimate "room is booked out" business result, not a failure.
export async function getRoomQuoteClient(roomId: string, checkIn: string, checkOut: string): Promise<QuoteResult> {
  try {
    const res = await fetch(`${PUBLIC_PROXY_URL}${quotePath(roomId, checkIn, checkOut)}`);
    return await toQuoteResult(res);
  } catch {
    return { ok: false, status: null, message: QUOTE_FALLBACK_ERROR };
  }
}
