import Link from "next/link";
import { formatTimestamp } from "@/lib/formatDate";
import { longOpenLabel } from "@/lib/posOrders";

// Shown on both POS boards when a cash shift has been open longer than a day
// (lib/shiftReconciliation.ts#isLongOpenShift) - so nobody has to go looking for a drawer that
// was never counted. Renders nothing when the list is empty.
export default function LongOpenShiftNotice({
  shifts,
  now,
  shiftsHref,
}: {
  shifts: { id: string; openedAt: string; openedByEmail?: string | null }[];
  now: Date;
  shiftsHref: string;
}) {
  if (shifts.length === 0) return null;
  return (
    <div className="mb-6 rounded-xl border border-amber-400/50 bg-amber-400/10 px-4 py-3 text-sm space-y-1">
      {shifts.map((s) => (
        <p key={s.id} className="text-cream">
          <span className="font-medium text-amber-400">{longOpenLabel(s.openedAt, now).replace("Open", "Shift open")}</span>
          {" - opened "}
          {formatTimestamp(s.openedAt)}
          {s.openedByEmail ? ` by ${s.openedByEmail}` : ""}. A shift should be closed when the drawer is counted.
        </p>
      ))}
      <Link href={shiftsHref} className="text-sea hover:text-coral transition-colors underline underline-offset-4">
        Go to shifts →
      </Link>
    </div>
  );
}
