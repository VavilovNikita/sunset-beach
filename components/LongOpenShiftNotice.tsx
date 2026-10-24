import Link from "next/link";
import { formatTimestamp } from "@/lib/formatDate";
import { staleShiftNotes, type StaleShiftInput } from "@/lib/staleWork";

// Shown where the till is used (both POS boards, the shift pages, the dashboard) when a cash shift has been open
// longer than a day (lib/staleWork.ts) - so nobody has to go looking for a drawer that was never counted. Nothing is
// closed by itself; the notice says whose shift it is and what the reader should do about it:
//   - the reader's own: count the drawer and close it;
//   - someone else's: it is not theirs to close from their shift - they open their own to take payments, and the
//     old one is closed by that person or by a manager (in Shift history).
// Renders nothing when the list is empty.
export default function LongOpenShiftNotice({
  shifts,
  now,
  viewerUserId,
  viewerHasOwnShift,
  canCloseOthers,
  ownShiftHref,
  othersHref,
}: {
  shifts: StaleShiftInput[];
  now: Date;
  viewerUserId: string;
  // null = unknown (the read failed): then nothing is said about opening one's own shift.
  viewerHasOwnShift: boolean | null;
  canCloseOthers: boolean;
  ownShiftHref: string;
  // Where a manager closes someone else's shift (Shift history); ignored when canCloseOthers is false.
  othersHref: string;
}) {
  const notes = staleShiftNotes(shifts, viewerUserId, now);
  if (notes.length === 0) return null;
  const others = notes.filter((n) => !n.mine);
  return (
    <div className="mb-6 rounded-xl border border-amber-400/50 bg-amber-400/10 px-4 py-3 text-sm space-y-2">
      {notes.map((n) => (
        <p key={n.id} className="text-cream">
          {n.mine ? (
            <>
              <span className="font-medium text-amber-400">Your shift has been open {n.age}</span> (since {formatTimestamp(n.openedAt)}). Count the
              drawer and close it.
            </>
          ) : (
            <>
              <span className="font-medium text-amber-400">{n.who}&rsquo;s shift has been open {n.age}</span> (since {formatTimestamp(n.openedAt)}). It
              is not yours: {canCloseOthers ? "close it from Shift history once its drawer is counted" : "ask them or a manager to count the drawer and close it"}.
            </>
          )}
        </p>
      ))}
      <div className="flex flex-wrap gap-x-6">
        {notes.some((n) => n.mine) && (
          <Link href={ownShiftHref} className="inline-flex items-center min-h-11 text-sea hover:text-coral transition-colors underline underline-offset-4">
            Close my shift →
          </Link>
        )}
        {others.length > 0 && canCloseOthers && (
          <Link href={othersHref} className="inline-flex items-center min-h-11 text-sea hover:text-coral transition-colors underline underline-offset-4">
            Shift history →
          </Link>
        )}
        {others.length > 0 && viewerHasOwnShift === false && (
          <span className="inline-flex items-center min-h-11 text-cream/80">
            You have no open shift of your own&nbsp;&mdash;&nbsp;
            <Link href={ownShiftHref} className="text-sea hover:text-coral transition-colors underline underline-offset-4">
              open yours
            </Link>{" "}
            to take payments.
          </span>
        )}
      </div>
    </div>
  );
}
