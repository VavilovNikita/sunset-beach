import { formatBaht, formatBahtOrDash, formatPercent } from "@/lib/reports";
import type { ManagerReportDay } from "@/lib/types";

// The manager-report page as data: five sections, each a list of figures read off one
// ManagerReportDay, so the page renders "tonight" and "same night last year" from the same rows
// and ManagerReportView.test.tsx can check every section is there without a browser. Every number is the
// server's; this only picks and formats.
//
// Captions say the endpoint's documented limitations (openapi.yaml, GET /reports/manager) in words
// a manager reads - no field names, API paths or legacy report codes. If a limitation changes
// there, change the sentence here too.

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
  "Restaurant, bar, spa and other revenue - revenue here is room revenue only;",
  "Group vs. individual (F.I.T.) rooms - bookings can't be linked into a group yet;",
  "Day-use rooms - there are no day-use stays yet.",
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
      "Total rooms is the rooms in service today - last year's column uses today's room count too, not the count back then.",
      "Occupancy is occupied rooms out of rooms available for sale, so out-of-order rooms don't count against it. The occupancy report counts them, so its figure can be lower.",
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
      "Counts only guests who have checked in, the same people the In-house list shows for that night - so it can be lower than occupied rooms, which also include guests who haven't arrived yet.",
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
      "Cancellations and no-shows are approximate: they count bookings that are cancelled or no-show now and were last changed on this date. A cancelled booking edited again the next day moves to that day, and a reinstated one drops out. Only today's figures are exact.",
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
      "Room revenue only - restaurant, bar and spa sales are not included (see below).",
      "Revenue per in-house guest divides all room revenue, including rooms whose guests haven't checked in yet, by the checked-in guests - so it can be higher than average rate per guest.",
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
