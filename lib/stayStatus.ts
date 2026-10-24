import type { Booking, StayStatus } from "@/lib/types";

// What happened to a stay, in words, for the guest card's stay history. The server derives it (`Booking.stayStatus`);
// the fallback only covers an older backend that does not send it yet - commercial `status` alone would call
// a finished stay "NEW", which was the bug.
const LABELS: Record<StayStatus, string> = {
  UPCOMING: "Upcoming",
  IN_HOUSE: "In house",
  CHECKED_OUT: "Checked out",
  CANCELLED: "Cancelled",
  NO_SHOW: "No-show",
};

export function stayStatusOf(b: Pick<Booking, "status" | "occupancyStatus" | "stayStatus">): StayStatus {
  if (b.stayStatus) return b.stayStatus;
  if (b.status === "CANCELLED") return "CANCELLED";
  switch (b.occupancyStatus) {
    case "NO_SHOW":
      return "NO_SHOW";
    case "CHECKED_OUT":
      return "CHECKED_OUT";
    case "CHECKED_IN":
      return "IN_HOUSE";
    default:
      return "UPCOMING";
  }
}

export function stayStatusLabel(b: Pick<Booking, "status" | "occupancyStatus" | "stayStatus">): string {
  return LABELS[stayStatusOf(b)];
}
