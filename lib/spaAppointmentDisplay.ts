// Display decisions for one spa appointment on the schedule grid and its panel - kept out of the
// components so they're tested (a wrong label or a cancellation that looks like an ordinary past
// appointment is invisible to a type checker).
import type { SpaAppointment, SpaAppointmentStatus } from "@/lib/posTypes";

// The billing door bills every treatment row on the appointment at once (one order line each -
// see lib/spaOrderClient.ts), so the button says how many.
export function billTreatmentsLabel(treatmentCount: number): string {
  return treatmentCount <= 1 ? "Bill treatment" : `Bill ${treatmentCount} treatments`;
}

// A cancelled or no-show block keeps its place on the grid (reception needs to see it happened)
// but must not read as an ordinary appointment that has simply passed. The palette is full, so it
// is told apart by shape - an icon, a dashed outline and hatching - not by a new colour.
export type SpaBlockMark = { icon: string; label: string };

export function spaBlockMark(status: SpaAppointmentStatus): SpaBlockMark | null {
  if (status === "CANCELLED") return { icon: "✕", label: "Cancelled" };
  if (status === "NO_SHOW") return { icon: "⊘", label: "No-show" };
  return null;
}

const STATUS_WORDS: Record<SpaAppointmentStatus, string> = {
  BOOKED: "Booked",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
  NO_SHOW: "No-show",
};

// The block's hover text: everything the narrow block itself may have to truncate.
export function spaBlockTitle(
  a: Pick<SpaAppointment, "guestName" | "roomUnitLabel" | "treatments" | "status" | "cancelReason">
): string {
  const parts = [a.guestName];
  if (a.roomUnitLabel) parts.push(`Room ${a.roomUnitLabel}`);
  parts.push(a.treatments.map((t) => t.treatmentName).join(", "));
  parts.push(a.status === "CANCELLED" && a.cancelReason ? `Cancelled: ${a.cancelReason}` : STATUS_WORDS[a.status]);
  return parts.join(" · ");
}
