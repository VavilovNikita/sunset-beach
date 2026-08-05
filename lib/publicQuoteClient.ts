import { PUBLIC_BACKEND_URL } from "@/lib/backend";
import { getNightsAndMonths, mergeQuote, type RoomQuote } from "@/lib/quote";
import type { PricingResponse, PublicAvailabilityResponse } from "@/lib/types";

// Client-side counterpart to lib/publicQuote.ts's getRoomQuote: same public,
// unauthenticated endpoints, hit directly from the browser at
// PUBLIC_BACKEND_URL (same pattern BookingGuestForm uses for POST /bookings)
// since backendFetch() needs next/headers and can't run client-side.
//
// Thrown QuoteFetchError means the request itself failed (network error or
// non-2xx) — distinct from a resolved { available: false } quote, which is a
// legitimate "room is booked out" business result, not a failure.
export class QuoteFetchError extends Error {}

export async function getRoomQuoteClient(roomId: string, checkIn: string, checkOut: string): Promise<RoomQuote> {
  const { nights, months } = getNightsAndMonths(checkIn, checkOut);
  if (months.length === 0) return { available: false, totalPrice: null };

  let pricingByMonth: PricingResponse[];
  let availabilityByMonth: PublicAvailabilityResponse[];
  try {
    [pricingByMonth, availabilityByMonth] = await Promise.all([
      Promise.all(
        months.map((month) =>
          fetch(`${PUBLIC_BACKEND_URL}/public/rooms/${roomId}/pricing?month=${month}`).then((res) => {
            if (!res.ok) throw new QuoteFetchError(`Pricing request failed with ${res.status}`);
            return res.json() as Promise<PricingResponse>;
          })
        )
      ),
      Promise.all(
        months.map((month) =>
          fetch(`${PUBLIC_BACKEND_URL}/public/rooms/${roomId}/availability?month=${month}`).then((res) => {
            if (!res.ok) throw new QuoteFetchError(`Availability request failed with ${res.status}`);
            return res.json() as Promise<PublicAvailabilityResponse>;
          })
        )
      ),
    ]);
  } catch (e) {
    throw e instanceof QuoteFetchError ? e : new QuoteFetchError("Network error while fetching pricing/availability");
  }

  return mergeQuote(nights, pricingByMonth, availabilityByMonth);
}
