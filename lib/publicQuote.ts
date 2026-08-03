import { backendFetch } from "@/lib/backendServer";
import { getNights, toDateKey } from "@/lib/bookings";
import type { PricingResponse, PublicAvailabilityResponse } from "@/lib/types";

// The public Java API only exposes pricing/availability per calendar month
// (GET /public/rooms/{id}/pricing|availability?month=YYYY-MM), not per
// arbitrary date range, so a stay that spans a month boundary needs one
// fetch per distinct month, merged locally — mirrors what the old
// isRangeAvailable/computeTotalPrice did against Prisma directly.
export async function getRoomQuote(roomId: string, checkIn: string, checkOut: string) {
  const nights = getNights(checkIn, checkOut);
  if (nights.length === 0) return { available: false, totalPrice: null as number | null };

  const months = Array.from(new Set(nights.map((d) => toDateKey(d).slice(0, 7))));

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
