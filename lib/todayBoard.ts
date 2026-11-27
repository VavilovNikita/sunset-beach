// Local, immediate updates of the Today board after a front-desk action, so a card moves the moment
// the server accepts the action instead of after the next page refresh. These are the *only*
// guesses the client makes about the server's grouping (see openapi.yaml's TodayBoard): a checked-in
// guest leaves "arriving" and joins the house, a checked-out or no-show guest leaves the board.
// TodayBoardView calls router.refresh() right after, and the server's own board replaces this one,
// so anything this gets wrong (an amount that changed meanwhile) is corrected within a request.
import { formatBaht } from "@/lib/money";
import type { Booking, TodayBoard, TodayBoardEntry } from "@/lib/types";

/** `booking` is the one returned by the check-in call, so the card shows the room and status as saved. */
export function applyCheckedIn(board: TodayBoard, entry: TodayBoardEntry, booking: Booking): TodayBoard {
  const id = entry.booking.id;
  const moved: TodayBoardEntry = { ...entry, booking, overdueDays: 0 };
  return {
    arrivingToday: board.arrivingToday.filter((e) => e.booking.id !== id),
    departingToday: board.departingToday,
    inHouse: [moved, ...board.inHouse.filter((e) => e.booking.id !== id)],
  };
}

/** A checked-out guest is on none of the three lists. */
export function applyCheckedOut(board: TodayBoard, bookingId: string): TodayBoard {
  return {
    arrivingToday: board.arrivingToday,
    departingToday: board.departingToday.filter((e) => e.booking.id !== bookingId),
    inHouse: board.inHouse.filter((e) => e.booking.id !== bookingId),
  };
}

/** A no-show is on none of the three lists either. */
export function applyNoShow(board: TodayBoard, bookingId: string): TodayBoard {
  return { ...board, arrivingToday: board.arrivingToday.filter((e) => e.booking.id !== bookingId) };
}

// The money line of a Today card. "owed" in red only for a debt that has fallen due (the server's `owes`, the Owes
// badge's rule); an arrival who has simply not paid yet is told neutrally, in the booking page's words.
export function todayMoney(owes: boolean | undefined, balance: string): { text: string; owed: boolean } | null {
  if (!(Number(balance) > 0)) return null;
  return owes === true
    ? { text: `${formatBaht(balance)} owed`, owed: true }
    : { text: `To pay at check-in ${formatBaht(balance)}`, owed: false };
}
