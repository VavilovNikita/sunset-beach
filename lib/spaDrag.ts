// What a drag on the spa schedule ends in when it does not end in a confirmation: a sentence next to the grid, never
// nothing. Which appointments can be dragged is the server's rule (SpaAppointmentService#updateSchedule): only a
// BOOKED one, and only to a start that has not passed. One whose own time has passed can still go to a later slot of
// the same day; on a day with no slot left (the grid shows one day) it cannot go anywhere. Pure, tested in
// spaDrag.test.ts.
import type { SpaAppointment } from "@/lib/posTypes";

// Why this appointment cannot be picked up, or null when it can.
export function spaDragBlock(appointment: Pick<SpaAppointment, "status" | "guestName">, noSlotLeft: boolean): string | null {
  switch (appointment.status) {
    case "BOOKED":
      return noSlotLeft
        ? `${appointment.guestName}'s appointment can't be moved - no slot of this day is still ahead. Open it to mark it completed or no-show.`
        : null;
    case "COMPLETED":
      return `${appointment.guestName}'s appointment is completed - it can't be moved.`;
    case "CANCELLED":
      return `${appointment.guestName}'s appointment is cancelled - it can't be moved.`;
    case "NO_SHOW":
      return `${appointment.guestName}'s appointment is marked no-show - it can't be moved.`;
  }
}

export type SpaDropMiss =
  | { kind: "outside" }
  | { kind: "interrupted" }
  | { kind: "occupied"; otherGuestName: string }
  | { kind: "swap-missed"; otherGuestName: string }
  | { kind: "past"; startTime: string };

export function spaDropMessage(miss: SpaDropMiss, guestName: string): string {
  const unchanged = `Nothing was changed: ${guestName}`;
  switch (miss.kind) {
    case "outside":
      return `${unchanged} was dropped outside the schedule's slots.`;
    case "interrupted":
      return `${unchanged}'s drag was interrupted.`;
    case "occupied":
      return `${unchanged} was dropped on ${miss.otherGuestName}'s appointment. Drop on a free slot, or on a booked appointment to swap tables.`;
    case "swap-missed":
      return `${unchanged} was released off ${miss.otherGuestName}'s appointment. Drop on it to swap tables, or drag again to a free slot.`;
    case "past":
      return `${unchanged} was not moved - ${miss.startTime} has already passed. Drop on the slot under way or a later one.`;
  }
}
