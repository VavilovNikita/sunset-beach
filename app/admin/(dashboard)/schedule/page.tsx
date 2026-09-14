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
    return { day: d, key, weekday: WEEKDAY_ABBR[new Date(`${key}T00:00:00Z`).getUTCDay()], entry: byDate.get(key) };
  });

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

      <div className="max-w-xl space-y-1">
        {days.map(({ day, key, weekday, entry }) => (
          <div key={key} className="flex items-center gap-4 bg-ink2/40 border border-cream/10 rounded-lg px-4 py-2">
            <p className="w-14 tabular-nums text-cream/60 text-sm">
              {day} {weekday}
            </p>
            {entry ? (
              <p className="flex-1 text-sm">
                {entry.shiftCode.code}
                {entry.shiftCode.startTime1
                  ? ` · ${entry.shiftCode.startTime1}–${entry.shiftCode.endTime1}${
                      entry.shiftCode.startTime2 ? `, ${entry.shiftCode.startTime2}–${entry.shiftCode.endTime2}` : ""
                    }`
                  : " · OP"}
                {entry.note && <span className="text-cream/40"> · {entry.note}</span>}
              </p>
            ) : (
              <p className="flex-1 text-sm text-cream/30">Day off</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
