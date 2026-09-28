import type { LifecycleEmailType } from "@/lib/types";

// Display helpers for the automated guest lifecycle emails (GuestCard's email history, the
// settings page). Pure, so they're tested in lifecycleEmails.test.ts.

export const LIFECYCLE_EMAIL_LABELS: Record<LifecycleEmailType, string> = {
  PRE_ARRIVAL: "Pre-arrival",
  POST_STAY: "Post-stay",
  WIN_BACK: "Win-back",
};

// sentAt is a date-time carrying the hotel's own +07:00 offset. Formatted explicitly in
// Asia/Bangkok, never the browser's zone, so every viewer sees the same hotel-local time.
export function formatSentAt(sentAt: string): string {
  const date = new Date(sentAt);
  if (Number.isNaN(date.getTime())) return sentAt;
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Bangkok",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
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
