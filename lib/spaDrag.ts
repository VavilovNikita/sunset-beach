// What a drag on the spa schedule ends in: a confirmation (a move, or a table swap) or a sentence next to the grid,
// never nothing - decided by what is under the release and by nothing the drag passed over. Which appointments can be dragged is the server's rule (SpaAppointmentService#updateSchedule): only a
// BOOKED one, and only to a start that has not passed. One whose own time has passed can still go to a later slot of
// the same day; on a day with no slot left (the grid shows one day) it cannot go anywhere. Pure, tested in
// spaDrag.test.ts.
import type { SpaAppointment } from "@/lib/posTypes";
import { slotIndexOf, slotSpanOf } from "@/lib/spaGridLayout";

// BOOKED and COMPLETED are the appointments that hold their slots; a cancelled or no-show one is drawn but holds nothing.
export const SPA_OCCUPYING_STATUSES: ReadonlySet<SpaAppointment["status"]> = new Set(["BOOKED", "COMPLETED"]);

export type SpaCell = { tableId: string; startTime: string };
export type SpaSlotGrid = { openingTime: string; slotMinutes: number };
type DragAppointment = Pick<SpaAppointment, "id" | "tableId" | "startTime" | "durationMinutes" | "status">;

// Who holds this table's slot, other than the appointment being dragged. Asked of the data, not of the element under
// the pointer, so it does not depend on how the bars are laid out (lib/calendarDrop.ts#findOccupant, same reason).
export function findSpaOccupant<T extends DragAppointment>(appointments: T[], cell: SpaCell, draggedId: string, grid: SpaSlotGrid): T | undefined {
  const slot = slotIndexOf(cell.startTime, grid.openingTime, grid.slotMinutes);
  return appointments.find((a) => {
    if (a.id === draggedId || a.tableId !== cell.tableId || !SPA_OCCUPYING_STATUSES.has(a.status)) return false;
    const start = slotIndexOf(a.startTime, grid.openingTime, grid.slotMinutes);
    return slot >= start && slot < start + slotSpanOf(a.durationMinutes, grid.slotMinutes);
  });
}

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
  | { kind: "past"; startTime: string };

export function spaDropMessage(miss: SpaDropMiss, guestName: string): string {
  const unchanged = `Nothing was changed: ${guestName}`;
  switch (miss.kind) {
    case "outside":
      return `${unchanged} was dropped outside the schedule's slots.`;
    case "interrupted":
      return `${unchanged}'s drag was interrupted.`;
    case "occupied":
      return `${unchanged} was dropped on ${miss.otherGuestName}'s appointment. Drop on a free slot, or on a booked appointment on another table to swap tables.`;
    case "past":
      return `${unchanged} was not moved - ${miss.startTime} has already passed. Drop on the slot under way or a later one.`;
  }
}

export type SpaDrop<T> =
  // Released where it started: nothing to ask and nothing to say.
  | { kind: "stay" }
  | { kind: "move"; cell: SpaCell }
  | { kind: "swap"; other: T }
  | { kind: "miss"; miss: SpaDropMiss };

// What releasing the dragged appointment over `cell` means (null: over no slot at all). A booked appointment on another
// table is a table swap; any other appointment holding the slot is a miss, and so is one on the dragged one's own table,
// where there are no two tables to exchange. A free slot is a move, whatever the drag passed on the way.
export function resolveSpaDrop<T extends DragAppointment & Pick<SpaAppointment, "guestName">>(
  cell: SpaCell | null,
  dragged: T,
  appointments: T[],
  grid: SpaSlotGrid,
  startsInPast: (startTime: string) => boolean
): SpaDrop<T> {
  if (!cell) return { kind: "miss", miss: { kind: "outside" } };
  const occupant = findSpaOccupant(appointments, cell, dragged.id, grid);
  if (occupant) {
    return occupant.status === "BOOKED" && occupant.tableId !== dragged.tableId
      ? { kind: "swap", other: occupant }
      : { kind: "miss", miss: { kind: "occupied", otherGuestName: occupant.guestName } };
  }
  if (cell.tableId === dragged.tableId && cell.startTime === dragged.startTime) return { kind: "stay" };
  if (startsInPast(cell.startTime)) return { kind: "miss", miss: { kind: "past", startTime: cell.startTime } };
  return { kind: "move", cell };
}
