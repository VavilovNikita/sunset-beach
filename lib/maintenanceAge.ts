import { hotelDateKey } from "@/lib/hotelDate";
import { daysBetweenUTC, dateOnlyUTC } from "@/lib/bookings";

// How long a maintenance task has been open, in hotel calendar days (a task filed at 23:00 and looked at at 08:00 the
// next morning is "1 day", not "0 days" or "9 hours"). A closed task is measured to the day it was closed.
export function taskOpenDays(createdAt: string, closedAt: string | null, now: Date): number {
  const from = dateOnlyUTC(hotelDateKey(new Date(createdAt)));
  const to = dateOnlyUTC(hotelDateKey(closedAt ? new Date(closedAt) : now));
  return Math.max(0, daysBetweenUTC(from, to));
}

export function taskOpenLabel(createdAt: string, closedAt: string | null, now: Date): string {
  const days = taskOpenDays(createdAt, closedAt, now);
  const text = days === 0 ? "today" : days === 1 ? "1 day" : `${days} days`;
  return closedAt ? `took ${text}` : days === 0 ? "open since today" : `open ${text}`;
}
