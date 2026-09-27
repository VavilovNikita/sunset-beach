import { parseDateKey } from "@/lib/bookings";

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

// A date-only "YYYY-MM-DD" key shown as e.g. "Apr 12, 1987". Parsed and formatted in UTC so it
// never shifts by a day in this timezone - see CLAUDE.md, "Dates".
export function formatDateOfBirth(key: string): string {
  return parseDateKey(key).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
}
