import { parseDateKey } from "@/lib/bookings";
import type { MarketSegment } from "@/lib/types";

// Display helpers for the reports page. Pure, so they're tested in reports.test.ts.

export type ReportRange = { from: string; to: string };

function validDateKey(param: string | undefined): string | null {
  if (!param) return null;
  try {
    parseDateKey(param);
    return param;
  } catch {
    return null;
  }
}

// The ?from=&to= query params. Either one missing or malformed (a hand-edited URL) falls back to
// the default range: the 1st of the hotel's current month through today. today is the hotel-local
// date key (hotelDateKey), passed in so this stays pure. from after to is kept as given - the
// page reports that itself rather than silently swapping the dates.
export function parseReportRange(from: string | undefined, to: string | undefined, today: string): ReportRange {
  const validFrom = validDateKey(from);
  const validTo = validDateKey(to);
  if (validFrom && validTo) return { from: validFrom, to: validTo };
  return { from: `${today.slice(0, 8)}01`, to: today };
}

// Both are YYYY-MM-DD, so string order is date order.
export function isRangeInverted(range: ReportRange): boolean {
  return range.from > range.to;
}

// The server sends a share as a two-decimal string, or null when the total is zero - a share of
// nothing is undefined, not 0%.
export function formatPercent(percent: string | null): string {
  return percent === null ? "—" : `${percent}%`;
}

// Money is a server-computed decimal string; this only formats it, same as the night-audit page.
export function formatBaht(amount: string): string {
  return `฿${Number(amount).toLocaleString("en-US")}`;
}

export const MARKET_SEGMENT_LABELS: Record<MarketSegment, string> = {
  COM: "Complimentary",
  DIR: "Direct",
  HFO: "House use",
  OTA: "Online travel agents",
  WLK: "Walk-in",
};
