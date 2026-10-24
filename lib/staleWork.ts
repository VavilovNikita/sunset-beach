// "Left open too long" for the two things a till can forget: a cash shift nobody counted and an order
// nobody closed. One threshold for both; nothing is closed automatically - the screens only say so and
// point to where it is dealt with (the owner's decision).
export const STALE_AFTER_HOURS = 24;

export function isStale(since: string, now: Date): boolean {
  const t = new Date(since).getTime();
  if (Number.isNaN(t)) return false;
  return now.getTime() - t >= STALE_AFTER_HOURS * 3600_000;
}

// "3 days" / "26 h" - how long something has been open.
export function staleAge(since: string, now: Date): string {
  const hours = Math.floor((now.getTime() - new Date(since).getTime()) / 3600_000);
  if (hours >= 48) return `${Math.floor(hours / 24)} days`;
  return `${hours} h`;
}

export type StaleShiftInput = {
  id: string;
  openedAt: string;
  openedByUserId?: string | null;
  openedByName?: string | null;
  openedByEmail?: string | null;
};

export type StaleShiftNote = {
  id: string;
  mine: boolean;
  who: string;
  age: string;
  openedAt: string;
};

// Whose long-open shift it is, from the viewer's point of view: their own is theirs to count and close; somebody
// else's is not - the viewer opens their own shift to take payments, and a manager closes the old one.
export function staleShiftNotes(shifts: StaleShiftInput[], viewerUserId: string, now: Date): StaleShiftNote[] {
  return shifts.map((s) => ({
    id: s.id,
    mine: s.openedByUserId != null && s.openedByUserId === viewerUserId,
    who: s.openedByName || s.openedByEmail || "Another user",
    age: staleAge(s.openedAt, now),
    openedAt: s.openedAt,
  }));
}
