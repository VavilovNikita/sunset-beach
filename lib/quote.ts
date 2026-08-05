// Pure quote-merging math shared by the server-side quote fetcher
// (lib/publicQuote.ts) and the client-side one (lib/publicQuoteClient.ts) —
// kept free of any server-only or fetch-mechanism-specific imports so both
// sides can share it.
import { getNights, toDateKey } from "@/lib/bookings";
import type { PricingResponse, PublicAvailabilityResponse } from "@/lib/types";

export type RoomQuote = { available: boolean; totalPrice: number | null };

export function getNightsAndMonths(checkIn: string, checkOut: string) {
  const nights = getNights(checkIn, checkOut);
  const months = Array.from(new Set(nights.map((d) => toDateKey(d).slice(0, 7))));
  return { nights, months };
}

export function mergeQuote(
  nights: Date[],
  pricingByMonth: PricingResponse[],
  availabilityByMonth: PublicAvailabilityResponse[]
): RoomQuote {
  if (nights.length === 0) return { available: false, totalPrice: null };

  const priceByDate = new Map<string, number>();
  for (const month of pricingByMonth) {
    for (const day of month.days) priceByDate.set(day.date, day.price);
  }

  const blockedByDate = new Map<string, boolean>();
  for (const month of availabilityByMonth) {
    for (const day of month.days) blockedByDate.set(day.date, day.isBlocked);
  }

  let available = true;
  let totalPrice = 0;
  for (const night of nights) {
    const key = toDateKey(night);
    if (blockedByDate.get(key)) available = false;
    totalPrice += priceByDate.get(key) ?? 0;
  }

  return { available, totalPrice };
}
