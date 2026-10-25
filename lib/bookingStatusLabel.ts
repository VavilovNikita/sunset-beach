import type { BookingStatus, SettlementStatus } from "@/lib/types";

// PAID means "the cost of the stay was paid" - not "everything is closed" (a guest who stayed on, or ran up charges
// to the room, still owes). So it is shown as "Room paid" everywhere; the value on the wire does not change. Every
// other status is shown as it always was.
export function bookingStatusLabel(status: BookingStatus): string {
  return status === "PAID" ? "Room paid" : status;
}

export type SettlementChip = { text: string; tone: "owes" | "credit" | "settled" };

const baht = (v: string | number) => `฿${Number(v).toLocaleString("en-US")}`;

// The money state shown next to the status, from the server's `settlement` (computed from the folio's own balance).
//  - OWES: "Owes ฿X" - once the debt has fallen due (`owes`); a future booking that is merely unpaid shows nothing.
//  - CREDIT: "Credit ฿X" - more was collected than was charged.
//  - SETTLED: "Settled" - only beside "Room paid": that is the one place "nothing left" needs saying.
// A row that carries no `settlement` (the night audit's unpaid-balance rows) falls back to its balance alone.
export function settlementChip(input: {
  settlement?: SettlementStatus | null;
  status?: BookingStatus | null;
  balanceDue?: string | number | null;
  creditBalance?: string | number | null;
  owes?: boolean | null;
}): SettlementChip | null {
  const balance = Number(input.balanceDue ?? 0);
  const settlement: SettlementStatus | null = input.settlement ?? (balance > 0 ? "OWES" : null);
  switch (settlement) {
    case "OWES":
      return input.owes === false || !(balance > 0) ? null : { text: `Owes ${baht(balance)}`, tone: "owes" };
    case "CREDIT": {
      const credit = Number(input.creditBalance ?? 0);
      return { text: credit > 0 ? `Credit ${baht(credit)}` : "Credit", tone: "credit" };
    }
    case "SETTLED":
      return input.status === "PAID" ? { text: "Settled", tone: "settled" } : null;
    default:
      return null;
  }
}

// The Stay block's explicit line when the room is paid but money is still owed (an overstay, POS charges to the room).
export function roomPaidButOwesLine(
  status: BookingStatus,
  settlement: SettlementStatus | null | undefined,
  balanceDue: string | number | null | undefined,
): string | null {
  if (status !== "PAID" || settlement !== "OWES" || !(Number(balanceDue) > 0)) return null;
  return `Room is paid, but ${baht(Number(balanceDue))} is still owed (overstay / charges)`;
}

// The overstay in one number: the nights charged, "incl. tonight" when tonight's night is among them, and what they
// cost. The server gives the count and the flag; nothing is derived from days overdue (that is the age of the missed
// departure, one less than the nights while tonight's has accrued).
export function overstayText(nights: number, includesTonight: boolean, total?: string | number | null): string {
  const base = `Overstaying ${nights} ${nights === 1 ? "night" : "nights"}${includesTonight ? " (incl. tonight)" : ""}`;
  return total != null && Number(total) > 0 ? `${base} · ${baht(Number(total))} charged` : base;
}
