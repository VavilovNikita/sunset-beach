// The dates a room move can start on, and the one a "Relocate from a date" form opens on.
//
// A move starts on a night of the stay. On the first night of a segment (a guest arriving today)
// the whole segment changes room; on a later night the segment is split and the nights before stay
// in the old room. So the allowed days are every night of the stay: today when it falls inside,
// else the nearest night. A CASHIER cannot pick a day before today (the server answers 403 - a
// back-dated move is a MANAGER's call); a MANAGER+ can pick any night of the stay.
import { addDaysUTC, parseDateKey, toDateKey } from "@/lib/bookings";

/** The last night of a stay: the day before check-out (a one-night stay's only night is check-in). */
function lastNight(checkIn: string, checkOut: string): string {
  const last = toDateKey(addDaysUTC(parseDateKey(checkOut), -1));
  return last < checkIn ? checkIn : last;
}

export function defaultRelocationDate(todayKey: string, checkIn: string, checkOut: string): string {
  const latest = lastNight(checkIn, checkOut);
  if (todayKey < checkIn) return checkIn;
  if (todayKey > latest) return latest;
  return todayKey;
}

/** `min`/`max` of the date input. `min` is today for a CASHIER (never before the stay starts either). */
export function relocationDateBounds(
  todayKey: string,
  checkIn: string,
  checkOut: string,
  canBackdate: boolean
): { min: string; max: string } {
  const max = lastNight(checkIn, checkOut);
  const min = canBackdate || todayKey < checkIn ? checkIn : todayKey > max ? max : todayKey;
  return { min, max };
}
