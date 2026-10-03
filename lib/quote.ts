// Shared by the server-side quote fetcher (lib/publicQuote.ts) and the client-side one
// (lib/publicQuoteClient.ts): both call GET /public/rooms/{id}/quote and turn its response into
// a QuoteResult the same way. The price is always the server's - this never adds up nightly
// prices itself (see sunset's CLAUDE.md, "Money"; this replaced a client-side sum of
// /pricing days, audit finding M14). Kept free of server-only imports so both sides can share it.
import { extractApiError } from "@/lib/apiError";
import type { BookingScheduleQuote } from "@/lib/types";

export type QuoteResult =
  | { ok: true; quote: BookingScheduleQuote }
  // `message` is the backend's own text where it gave one (a 400's validation message, a 429's
  // "too many price requests"), so a guest sees the server's reason, not a client-side guess.
  | { ok: false; status: number | null; message: string };

export const QUOTE_FALLBACK_ERROR = "Couldn’t check pricing and availability for those dates.";

export function quotePath(roomId: string, checkIn: string, checkOut: string): string {
  const query = new URLSearchParams({ checkIn, checkOut });
  return `/public/rooms/${encodeURIComponent(roomId)}/quote?${query}`;
}

export async function toQuoteResult(res: Response): Promise<QuoteResult> {
  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    // Non-JSON body (proxy error page, empty 5xx) - fall through to the generic message.
  }
  if (res.ok && body && typeof body === "object") {
    return { ok: true, quote: body as BookingScheduleQuote };
  }
  return { ok: false, status: res.status, message: extractApiError(body, QUOTE_FALLBACK_ERROR) };
}

export function formatQuoteTotal(quote: BookingScheduleQuote): string {
  return `฿${Number(quote.totalPrice).toLocaleString("en-US")}`;
}
