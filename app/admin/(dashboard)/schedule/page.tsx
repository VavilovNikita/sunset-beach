import Link from "next/link";
import { backendJson } from "@/lib/backendServer";
import { requireSessionUser } from "@/lib/rbac";
import type { RosterEntry } from "@/lib/types";

const WEEKDAY_ABBR = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default async function AdminSchedulePage({ searchParams }: { searchParams: { year?: string; month?: string } }) {
  // GET /roster/me has no role floor at all - any authenticated staff member reads their own
  // schedule, no pay, no coverage warnings, no other employee's schedule (see this endpoint's own
  // description).
  await requireSessionUser();

  const now = new Date();
  const year = Number(searchParams.year) || now.getUTCFullYear();
  const month = Number(searchParams.month) || now.getUTCMonth() + 1;
  const prevMonth = month === 1 ? { year: year - 1, month: 12 } : { year, month: month - 1 };
  const nextMonth = month === 12 ? { year: year + 1, month: 1 } : { year, month: month + 1 };
  const qs = (y: number, m: number) => `/admin/schedule?year=${y}&month=${m}`;

  const entries = await backendJson<RosterEntry[]>(`/roster/me?year=${year}&month=${month}`, { auth: true });
  const byDate = new Map(entries.map((e) => [e.date, e]));

  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const days = Array.from({ length: daysInMonth }, (_, i) => {
    const d = i + 1;
    const key = `${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    return { day: d, key, entry: byDate.get(key) };
  });
  // Blank cells before day 1 so it lands under its own weekday column (WEEKDAY_ABBR is Sun-first).
  const leadingBlanks = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
  // Hotel-local today, not the server's zone - only used to highlight a cell.
  const todayKey = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok" }).format(now);

  return (
    <div>
      <p className="eyebrow text-sea mb-2">Staff</p>
      <h1 className="font-display italic text-3xl mb-6">My schedule</h1>

      <div className="flex items-center gap-3 mb-6">
        <Link href={qs(prevMonth.year, prevMonth.month)} className="text-sm text-sea hover:text-coral transition-colors">
          ← Prev
        </Link>
        <p className="text-sm text-cream/70 tabular-nums">
          {year}-{String(month).padStart(2, "0")}
        </p>
        <Link href={qs(nextMonth.year, nextMonth.month)} className="text-sm text-sea hover:text-coral transition-colors">
          Next →
        </Link>
      </div>

      <div className="max-w-4xl grid grid-cols-7 gap-1 sm:gap-2">
        {WEEKDAY_ABBR.map((w) => (
          <p key={w} className="eyebrow text-cream/40 text-center pb-1">
            {w}
          </p>
        ))}
        {Array.from({ length: leadingBlanks }, (_, i) => (
          <div key={`blank-${i}`} aria-hidden />
        ))}
        {days.map(({ day, key, entry }) => (
          <div
            key={key}
            title={entry?.note ?? undefined}
            className={`min-h-[4.5rem] sm:min-h-[6rem] min-w-0 rounded-lg border px-1.5 py-1 sm:px-2 sm:py-1.5 ${
              entry ? "bg-ink2/60 border-cream/15" : "bg-ink2/20 border-cream/5"
            } ${key === todayKey ? "ring-1 ring-coral" : ""}`}
          >
            <p className={`text-xs tabular-nums ${key === todayKey ? "text-coral" : "text-cream/50"}`}>{day}</p>
            {entry ? (
              <div className="mt-0.5 text-[10px] sm:text-xs leading-tight tabular-nums">
                <p className="font-medium text-sm sm:text-base text-cream truncate">{entry.shiftCode.code}</p>
                {entry.shiftCode.startTime1 ? (
                  <>
                    <p className="text-cream/70">
                      {entry.shiftCode.startTime1}–<wbr />
                      {entry.shiftCode.endTime1}
                    </p>
                    {entry.shiftCode.startTime2 && (
                      <p className="text-cream/70">
                        {entry.shiftCode.startTime2}–<wbr />
                        {entry.shiftCode.endTime2}
                      </p>
                    )}
                  </>
                ) : (
                  <p className="text-cream/70">OP</p>
                )}
                {/* Too long for a cell: a marker on phones (tap to reveal), the text itself from sm up. */}
                {entry.note && (
                  <>
                    <details className="sm:hidden mt-0.5">
                      <summary className="cursor-pointer list-none text-sea">Note</summary>
                      <p className="text-cream/60 break-words">{entry.note}</p>
                    </details>
                    <p className="hidden sm:block mt-0.5 text-cream/40 truncate">{entry.note}</p>
                  </>
                )}
              </div>
            ) : (
              <p className="mt-0.5 text-[10px] sm:text-xs text-cream/30">Day off</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
