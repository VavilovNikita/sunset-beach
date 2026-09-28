import type { BookingPurpose } from "@/lib/types";

export const BOOKING_PURPOSES: BookingPurpose[] = ["STANDARD", "COMPLIMENTARY", "HOUSE_USE"];

export const BOOKING_PURPOSE_LABELS: Record<BookingPurpose, string> = {
  STANDARD: "Standard (paying guest)",
  COMPLIMENTARY: "Complimentary",
  HOUSE_USE: "House use",
};

// Party-size inputs are kept as strings while typing (an emptied field is "", not 0). Parsed once
// on submit, with the same floor the backend enforces: at least one adult, never negative
// children. Returns an error message instead of numbers when the input can't be sent.
export function parsePartySize(adults: string, children: string): { adults: number; children: number } | { error: string } {
  const a = Number(adults.trim());
  const c = children.trim() === "" ? 0 : Number(children.trim());
  if (adults.trim() === "" || !Number.isInteger(a) || a < 1) {
    return { error: "At least one adult is required." };
  }
  if (!Number.isInteger(c) || c < 0) {
    return { error: "Children must be 0 or more." };
  }
  return { adults: a, children: c };
}

// "2 adults, 1 child" — for anywhere a booking's party size is shown read-only.
export function formatPartySize(adults: number, children: number): string {
  const a = `${adults} adult${adults === 1 ? "" : "s"}`;
  return children > 0 ? `${a}, ${children} child${children === 1 ? "" : "ren"}` : a;
}
