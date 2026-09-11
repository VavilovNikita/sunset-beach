// Sums SpaAppointmentTreatment.currentPrice values for display only - a running total shown
// while picking/reviewing treatments, never sent anywhere and never the number a guest is
// actually charged (that's computed server-side, live, the moment a treatment becomes a billed
// OrderItem - see the backend CLAUDE.md's Spa billing section). Each individual price is already
// a real server-supplied number (MenuItem.price, read live); this only adds them together for a
// glance total, the same "sum of already-known numbers, shown for guidance" the create modal and
// the appointment panel both need - extracted here instead of duplicated in both, per this
// project's own testing convention (lib/ is where a computed number gets tested).
export function sumTreatmentPrices(prices: string[]): number {
  return prices.reduce((total, price) => total + Number(price), 0);
}
