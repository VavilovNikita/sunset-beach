// What the booking form can say before it saves: is this therapist (or this table) already taken
// for [startTime, startTime + duration) on the day on screen. The server's exclusion constraints
// stay the real guard - this only reads the day schedule the page already loaded, so reception
// sees a busy therapist greyed out instead of learning about it from a 409. Same occupancy rule as
// the backend constraints: BOOKED and COMPLETED hold their slot, CANCELLED and NO_SHOW don't.
import type { SpaAppointment } from "@/lib/posTypes";

const OCCUPYING: ReadonlySet<SpaAppointment["status"]> = new Set(["BOOKED", "COMPLETED"]);

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

function toHHMM(minutes: number): string {
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}

export type SpaClash = { appointmentId: string; guestName: string; from: string; to: string };

type Occupant = Pick<SpaAppointment, "id" | "guestName" | "startTime" | "durationMinutes" | "status">;

// The first occupying appointment overlapping [startTime, startTime + durationMinutes), or null.
// Half-open on both sides, like the constraint: one ending at 11:00 and one starting at 11:00 is fine.
function firstClash(occupants: Occupant[], startTime: string, durationMinutes: number): SpaClash | null {
  const start = toMinutes(startTime);
  const end = start + durationMinutes;
  const clash = occupants
    .filter((a) => OCCUPYING.has(a.status))
    .sort((a, b) => toMinutes(a.startTime) - toMinutes(b.startTime))
    .find((a) => {
      const aStart = toMinutes(a.startTime);
      return aStart < end && start < aStart + a.durationMinutes;
    });
  if (!clash) return null;
  const from = toMinutes(clash.startTime);
  return { appointmentId: clash.id, guestName: clash.guestName, from: toHHMM(from), to: toHHMM(from + clash.durationMinutes) };
}

export function therapistClash(
  appointments: (Occupant & Pick<SpaAppointment, "therapistUserId">)[],
  therapistUserId: string,
  startTime: string,
  durationMinutes: number
): SpaClash | null {
  return firstClash(
    appointments.filter((a) => a.therapistUserId === therapistUserId),
    startTime,
    durationMinutes
  );
}

export function tableClash(
  appointments: (Occupant & Pick<SpaAppointment, "tableId">)[],
  tableId: string,
  startTime: string,
  durationMinutes: number
): SpaClash | null {
  return firstClash(
    appointments.filter((a) => a.tableId === tableId),
    startTime,
    durationMinutes
  );
}

// Everything one therapist already holds that day, in time order - the form lists it under the
// picker so reception can see when they *are* free, not just that the chosen slot isn't.
export function therapistDay(
  appointments: Pick<SpaAppointment, "startTime" | "durationMinutes" | "status" | "therapistUserId">[],
  therapistUserId: string
): { from: string; to: string }[] {
  return appointments
    .filter((a) => a.therapistUserId === therapistUserId && OCCUPYING.has(a.status))
    .sort((a, b) => toMinutes(a.startTime) - toMinutes(b.startTime))
    .map((a) => ({ from: a.startTime, to: toHHMM(toMinutes(a.startTime) + a.durationMinutes) }));
}
