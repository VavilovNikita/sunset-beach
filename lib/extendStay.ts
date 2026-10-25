import { addDaysToDateKey, hotelDateKey } from "@/lib/hotelDate";

// "Extend the stay" for a guest who is still in the house past their check-out: the form opens with the new departure
// set to tomorrow (they sleep here tonight), in the hotel's calendar, never the browser's.
export const EXTEND_STAY_EVENT = "sunset:extend-stay";
export const EXTEND_STAY_HASH = "extend-stay";

export function extendedCheckOut(now: Date): string {
  return addDaysToDateKey(hotelDateKey(now), 1);
}
