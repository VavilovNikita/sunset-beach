import { formatDate } from "@/lib/formatDate";
import type { Booking } from "@/lib/types";

// Turns the guest form's comma-separated tags field into the array PATCH/POST /guests expects.
// Mirrors the server's own normalization (GuestMapper#normalizeTags): trim each tag, drop blank
// ones and exact duplicates, keep first-entered order. The server applies it regardless - this
// just keeps what the form shows after saving identical to what was typed.
export function parseTagsInput(text: string): string[] {
  const seen = new Set<string>();
  const tags: string[] = [];
  for (const raw of text.split(",")) {
    const tag = raw.trim();
    if (tag && !seen.has(tag)) {
      seen.add(tag);
      tags.push(tag);
    }
  }
  return tags;
}

// The inverse, for prefilling the edit form.
export function formatTagsInput(tags: string[]): string {
  return tags.join(", ");
}

// A date-only "YYYY-MM-DD" key shown as e.g. "12 Apr 1987" - the admin's one date format
// (lib/formatDate.ts), which never shifts the day.
export function formatDateOfBirth(key: string): string {
  return formatDate(key);
}

// "Repeat guest" = more than one stay that wasn't cancelled. Derived from the card's own stay
// history (GuestDetail.bookings, every status included) — deliberately not a stored flag or an
// API field, since everything needed is already on the object the card has.
export function isRepeatGuest(bookings: Pick<Booking, "status">[]): boolean {
  return bookings.filter((b) => b.status !== "CANCELLED").length > 1;
}
