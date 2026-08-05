import { backendFetch } from "@/lib/backendServer";
import { getNightsAndMonths, mergeQuote, type RoomQuote } from "@/lib/quote";
import type { PricingResponse, PublicAvailabilityResponse } from "@/lib/types";

// The public Java API only exposes pricing/availability per calendar month
// (GET /public/rooms/{id}/pricing|availability?month=YYYY-MM), not per
// arbitrary date range, so a stay that spans a month boundary needs one
// fetch per distinct month, merged locally — mirrors what the old
// isRangeAvailable/computeTotalPrice did against Prisma directly.
export async function getRoomQuote(roomId: string, checkIn: string, checkOut: string): Promise<RoomQuote> {
  const { nights, months } = getNightsAndMonths(checkIn, checkOut);
  if (months.length === 0) return { available: false, totalPrice: null };

  const [pricingByMonth, availabilityByMonth] = await Promise.all([
    Promise.all(
      months.map((month) =>
        backendFetch(`/public/rooms/${roomId}/pricing?month=${month}`).then(
          (res) => res.json() as Promise<PricingResponse>
        )
      )
    ),
    Promise.all(
      months.map((month) =>
        backendFetch(`/public/rooms/${roomId}/availability?month=${month}`).then(
          (res) => res.json() as Promise<PublicAvailabilityResponse>
        )
      )
    ),
  ]);

  return mergeQuote(nights, pricingByMonth, availabilityByMonth);
}
