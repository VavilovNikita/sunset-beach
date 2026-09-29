import { formatBaht, formatBahtOrDash, formatPercent } from "@/lib/reports";
import type { ManagerReportDay } from "@/lib/types";

// The manager-report page as data: five sections, each a list of figures read off one
// ManagerReportDay, so the page renders "tonight" and "same night last year" from the same rows
// and ManagerReportView.test.tsx can check every section is there without a browser. Every number is the
// server's; this only picks and formats.
//
// Captions are the endpoint's own openapi.yaml wording (GET /reports/manager, and the schemas'
// field descriptions), markdown stripped - kept verbatim so the page and the API doc can't drift
// into saying two different things about the same limitation. Change them there first.

export type ManagerReportRow = {
  label: string;
  value: (day: ManagerReportDay) => string;
};

export type ManagerReportSection = {
  key: "rooms" | "guests" | "accounts" | "revenue" | "tomorrow";
  title: string;
  rows: ManagerReportRow[];
  captions: string[];
};

const count = (n: number) => String(n);
const decimalOrDash = (value: string | null) => (value === null ? "—" : value);

export const MANAGER_REPORT_LEFT_OUT = [
  "F&B and miscellaneous revenue lines (there is no revenue-code taxonomy to group POS sales into those lines yet - revenue here is room revenue only);",
  "Group vs. F.I.T. occupied rooms (no concept links several bookings into a group);",
  "and Day-Use rooms (no day-use / no-overnight concept exists).",
];

export const MANAGER_REPORT_SECTIONS: ManagerReportSection[] = [
  {
    key: "rooms",
    title: "Room statistic",
    rows: [
      { label: "Total rooms", value: (d) => count(d.rooms.totalRooms) },
      { label: "Out of order", value: (d) => count(d.rooms.outOfOrder) },
      { label: "Available for sale", value: (d) => count(d.rooms.availableForSale) },
      { label: "Occupied", value: (d) => count(d.rooms.occupied) },
      { label: "Complimentary", value: (d) => count(d.rooms.complimentary) },
      { label: "House use", value: (d) => count(d.rooms.houseUse) },
      { label: "Occupied excl. comp & house use", value: (d) => count(d.rooms.occupiedExcludingCompAndHouseUse) },
      { label: "Occupancy", value: (d) => formatPercent(d.rooms.occupancyPercent) },
      { label: "Average rate per occupied room", value: (d) => formatBahtOrDash(d.rooms.averageRatePerOccupiedRoom) },
      { label: "Revenue per available room", value: (d) => formatBahtOrDash(d.rooms.averageRevenuePerAvailableRoom) },
    ],
    captions: [
      "totalRooms - physical units active today (the same known simplification as GET /reports/occupancy: today's inventory, not a historical count, also for lastYear).",
      "occupancyPercent = occupied / availableForSale × 100 - out-of-order rooms are taken out of the denominator here, unlike GET /reports/occupancy, which does not subtract blocks.",
    ],
  },
  {
    key: "guests",
    title: "Guest statistic",
    rows: [
      { label: "Adults in house", value: (d) => count(d.guests.adultsInHouse) },
      { label: "Children in house", value: (d) => count(d.guests.childrenInHouse) },
      { label: "Guests in house", value: (d) => count(d.guests.guestsInHouse) },
      { label: "Average guests per room", value: (d) => decimalOrDash(d.guests.averageGuestsPerRoom) },
      { label: "Average rate per guest", value: (d) => formatBahtOrDash(d.guests.averageRatePerGuest) },
      { label: "Average length of stay (nights)", value: (d) => decimalOrDash(d.guests.averageLengthOfStay) },
      { label: "Complimentary guests", value: (d) => count(d.guests.complimentaryGuests) },
      { label: "House use guests", value: (d) => count(d.guests.houseUseGuests) },
    ],
    captions: [
      "Over the guests in house that night, exactly the rows GET /reports/in-house?date= returns (checked-in guests only, so it can be lower than occupied, which also counts rooms whose guests have not arrived yet).",
    ],
  },
  {
    key: "accounts",
    title: "Account count",
    rows: [
      { label: "Arrivals", value: (d) => count(d.accounts.arrivals) },
      { label: "Departures", value: (d) => count(d.accounts.departures) },
      { label: "Cancellations", value: (d) => count(d.accounts.cancellations) },
      { label: "No-shows", value: (d) => count(d.accounts.noShows) },
      { label: "Walk-in rooms", value: (d) => count(d.accounts.walkInRooms) },
    ],
    captions: [
      "cancellations / noShows are approximations: no booking records when it was cancelled or marked no-show, so they count bookings that are CANCELLED / NO_SHOW now and whose updatedAt falls on date (hotel-local). Any later edit to the booking moves its updatedAt - a cancelled booking edited the next day stops counting for the day it was cancelled - and a booking cancelled and later reinstated no longer counts at all. Treat both as exact only for today.",
    ],
  },
  {
    key: "revenue",
    title: "Revenue",
    rows: [
      { label: "Room revenue", value: (d) => formatBaht(d.revenue.roomRevenue) },
      { label: "Revenue per in-house guest", value: (d) => formatBahtOrDash(d.revenue.averageRevenuePerInHouseGuest) },
    ],
    captions: [
      "Room revenue only - see the operation for what is left out.",
      "averageRevenuePerInHouseGuest = roomRevenue / in-house guests - unlike averageRatePerGuest, the numerator includes rooms sold but not yet checked into.",
    ],
  },
  {
    key: "tomorrow",
    title: "Tomorrow's forecast",
    rows: [
      { label: "Arrivals", value: (d) => count(d.tomorrow.arrivals) },
      { label: "Departures", value: (d) => count(d.tomorrow.departures) },
      { label: "Occupied", value: (d) => count(d.tomorrow.occupied) },
      { label: "Available for sale", value: (d) => count(d.tomorrow.availableForSale) },
      { label: "Occupancy", value: (d) => formatPercent(d.tomorrow.occupancyPercent) },
    ],
    captions: ["The next night's figures."],
  },
];
