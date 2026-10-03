import type { LifecycleEmailType } from "@/lib/types";
import { formatTimestamp } from "@/lib/formatDate";

// Display helpers for the automated guest lifecycle emails (GuestCard's email history, the
// settings page). Pure, so they're tested in lifecycleEmails.test.ts.

export const LIFECYCLE_EMAIL_LABELS: Record<LifecycleEmailType, string> = {
  PRE_ARRIVAL: "Pre-arrival",
  POST_STAY: "Post-stay",
  WIN_BACK: "Win-back",
};

// sentAt is a date-time carrying the hotel's own +07:00 offset, shown in hotel-local time
// (lib/formatDate.ts).
export function formatSentAt(sentAt: string): string {
  return formatTimestamp(sentAt);
}

// Parses a settings number field. Returns null for anything that isn't a whole number inside
// [min, max] — the form shows its own message then, instead of sending a value the server
// would reject with a less specific one.
export function parseWholeNumberInRange(text: string, min: number, max: number): number | null {
  const trimmed = text.trim();
  if (!/^\d+$/.test(trimmed)) return null;
  const value = Number(trimmed);
  return value >= min && value <= max ? value : null;
}
