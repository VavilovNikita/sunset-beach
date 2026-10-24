import { backendJsonOrDefault } from "@/lib/backendServer";
import { hotelDateKey } from "@/lib/hotelDate";
import { hasRoleAtLeast } from "@/lib/rbac";
import { isStale } from "@/lib/staleWork";
import type { ShiftListItem, ShiftSummary } from "@/lib/posTypes";
import type { SessionUser } from "@/lib/session";

export type StaleShiftsView = {
  now: Date;
  // Open for more than a day: every shift for a manager, the viewer's own for a cashier.
  shifts: (ShiftListItem | ShiftSummary)[];
  // Whether the viewer has a shift of their own open right now; null when that could not be read.
  viewerHasOwnShift: boolean | null;
  isManager: boolean;
};

// Secondary data: a failed read shows nothing (and says nothing about the viewer's own shift), it never takes the
// page down. A manager reads GET /shifts (bounded to a year back so the board does not pull every shift ever);
// a cashier has only GET /shifts/current. A waiter has no drawer.
export async function loadStaleShifts(user: SessionUser): Promise<StaleShiftsView> {
  const now = new Date();
  const isManager = hasRoleAtLeast(user.role, "MANAGER");
  const isCashier = hasRoleAtLeast(user.role, "CASHIER");
  if (!isCashier) return { now, shifts: [], viewerHasOwnShift: null, isManager };

  if (isManager) {
    const all = await backendJsonOrDefault<ShiftListItem[] | null>(`/shifts?from=${hotelDateKey(new Date(now.getTime() - 365 * 86400_000))}`, null, { auth: true });
    if (all === null) return { now, shifts: [], viewerHasOwnShift: null, isManager };
    return {
      now,
      shifts: all.filter((s) => s.status === "OPEN" && isStale(s.openedAt, now)),
      viewerHasOwnShift: all.some((s) => s.status === "OPEN" && s.openedByUserId === user.id),
      isManager,
    };
  }

  // /shifts/current answers 404 when the viewer has no open shift - an ordinary state, read as "none".
  const current = await backendJsonOrDefault<ShiftSummary | null>("/shifts/current", null, { auth: true });
  return {
    now,
    shifts: current && current.status === "OPEN" && isStale(current.openedAt, now) ? [current] : [],
    viewerHasOwnShift: current !== null,
    isManager,
  };
}
