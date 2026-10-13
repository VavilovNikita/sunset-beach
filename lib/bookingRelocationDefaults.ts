// The date a "Relocate from a date" form opens on. A relocation splits a stay at an interior day -
// after the first night starts and before the last one ends - so: today when that falls inside the
// stay, else the nearest allowed day (the day after check-in for a stay still ahead, the last night
// for one that is nearly over). A one-night stay has no interior day at all; the check-in date is
// returned and the server's quote says why it can't be split.
import { addDaysUTC, parseDateKey, toDateKey } from "@/lib/bookings";

export function defaultRelocationDate(todayKey: string, checkIn: string, checkOut: string): string {
  const earliest = toDateKey(addDaysUTC(parseDateKey(checkIn), 1));
  const latest = toDateKey(addDaysUTC(parseDateKey(checkOut), -1));
  if (earliest > latest) return checkIn;
  if (todayKey < earliest) return earliest;
  if (todayKey > latest) return latest;
  return todayKey;
}
