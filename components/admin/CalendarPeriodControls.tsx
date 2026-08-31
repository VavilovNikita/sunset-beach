"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { addDaysUTC, addMonthsUTC, daysBetweenUTC, parseDateKey, startOfMonthUTC, toDateKey } from "@/lib/bookings";
import { MAX_CALENDAR_RANGE_DAYS, saveStoredPeriod } from "@/lib/calendarRange";

function formatRangeLabel(from: Date, to: Date) {
  const lastVisibleDay = addDaysUTC(to, -1); // `to` itself is exclusive, same convention as a stay
  const sameMonth = from.getUTCFullYear() === lastVisibleDay.getUTCFullYear() && from.getUTCMonth() === lastVisibleDay.getUTCMonth();
  const fmtFull = (d: Date) => d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
  const fmtShort = (d: Date) => d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
  const days = daysBetweenUTC(from, to);
  const range = sameMonth ? `${fmtShort(from)} – ${lastVisibleDay.getUTCDate()}, ${from.getUTCFullYear()}` : `${fmtFull(from)} – ${fmtFull(lastVisibleDay)}`;
  return `${range} (${days} day${days === 1 ? "" : "s"})`;
}

function validateRange(from: Date, to: Date): string | null {
  if (!(from.getTime() < to.getTime())) {
    return "The start date must be before the end date.";
  }
  const days = daysBetweenUTC(from, to);
  if (days > MAX_CALENDAR_RANGE_DAYS) {
    return `That's ${days} days — the calendar can show at most ${MAX_CALENDAR_RANGE_DAYS} days (about a year) at once. Pick a shorter period.`;
  }
  return null;
}

// Owned by the URL (see the calendar page), same reasoning as BookingCalendarGrid's density used
// to be owned by it before density became independent: the visible period decides how much data
// the page fetches, which only the page's own server-side render can do - a client-only period
// toggle would be stuck re-rendering whatever range it already has.
export default function CalendarPeriodControls({ from, to }: { from: string; to: string }) {
  const router = useRouter();
  const [fromInput, setFromInput] = useState(from);
  const [toInput, setToInput] = useState(to);
  const [error, setError] = useState<string | null>(null);

  // Prev/Next/Today/quick-picks all navigate via the URL (see navigateTo) - when that lands, the
  // new from/to props need to flow back into the editable fields too, or they'd keep showing
  // whatever the user last typed instead of the range actually on screen.
  useEffect(() => {
    setFromInput(from);
    setToInput(to);
    setError(null);
  }, [from, to]);

  function navigateTo(nextFrom: Date, nextTo: Date) {
    const validationError = validateRange(nextFrom, nextTo);
    if (validationError) {
      setError(validationError);
      return;
    }
    setError(null);
    const nextFromKey = toDateKey(nextFrom);
    const nextToKey = toDateKey(nextTo);
    saveStoredPeriod({ from: nextFromKey, to: nextToKey });
    router.push(`/admin/bookings/calendar?from=${nextFromKey}&to=${nextToKey}`);
  }

  function handleApply(e: React.FormEvent) {
    e.preventDefault();
    let parsedFrom: Date;
    let parsedTo: Date;
    try {
      parsedFrom = parseDateKey(fromInput);
      parsedTo = parseDateKey(toInput);
    } catch {
      setError("Enter valid dates.");
      return;
    }
    navigateTo(parsedFrom, parsedTo);
  }

  function shiftBySpan(direction: 1 | -1) {
    const currentFrom = parseDateKey(from);
    const currentTo = parseDateKey(to);
    const span = daysBetweenUTC(currentFrom, currentTo);
    navigateTo(addDaysUTC(currentFrom, direction * span), addDaysUTC(currentTo, direction * span));
  }

  function handleToday() {
    const currentFrom = parseDateKey(from);
    const currentTo = parseDateKey(to);
    const span = daysBetweenUTC(currentFrom, currentTo);
    const today = new Date();
    const todayUTC = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
    navigateTo(todayUTC, addDaysUTC(todayUTC, span));
  }

  function handleQuickPick(months: number) {
    const monthStart = startOfMonthUTC(new Date());
    navigateTo(monthStart, addMonthsUTC(monthStart, months));
  }

  return (
    <div className="mb-6">
      <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => shiftBySpan(-1)}
            title="Shift back by the currently visible width"
            className="rounded-full border border-cream/25 hover:border-cream/50 transition-colors px-4 py-2 text-sm"
          >
            ← Prev
          </button>
          <button
            type="button"
            onClick={handleToday}
            className="rounded-full border border-cream/25 hover:border-cream/50 transition-colors px-4 py-2 text-sm"
          >
            Today
          </button>
          <button
            type="button"
            onClick={() => shiftBySpan(1)}
            title="Shift forward by the currently visible width"
            className="rounded-full border border-cream/25 hover:border-cream/50 transition-colors px-4 py-2 text-sm"
          >
            Next →
          </button>
        </div>

        <div className="flex items-center gap-2">
          <span className="eyebrow text-cream/40 mr-1">Quick pick</span>
          <button
            type="button"
            onClick={() => handleQuickPick(1)}
            className="rounded-full border border-cream/25 hover:border-cream/50 transition-colors px-3 py-1.5 text-xs font-medium"
          >
            This month
          </button>
          <button
            type="button"
            onClick={() => handleQuickPick(3)}
            className="rounded-full border border-cream/25 hover:border-cream/50 transition-colors px-3 py-1.5 text-xs font-medium"
          >
            Next 3 months
          </button>
          <button
            type="button"
            onClick={() => handleQuickPick(12)}
            className="rounded-full border border-cream/25 hover:border-cream/50 transition-colors px-3 py-1.5 text-xs font-medium"
          >
            Year
          </button>
        </div>
      </div>

      <form onSubmit={handleApply} className="flex flex-wrap items-end gap-4 bg-ink2/40 border border-cream/10 rounded-xl p-4">
        <div>
          <label className="eyebrow text-cream/60 block mb-1">From</label>
          <input
            type="date"
            value={fromInput}
            onChange={(e) => setFromInput(e.target.value)}
            className="bg-ink2 border border-cream/20 rounded-lg px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="eyebrow text-cream/60 block mb-1">To</label>
          <input
            type="date"
            value={toInput}
            onChange={(e) => setToInput(e.target.value)}
            className="bg-ink2 border border-cream/20 rounded-lg px-3 py-2 text-sm"
          />
        </div>
        <button
          type="submit"
          className="rounded-full bg-coral hover:bg-coraldeep transition-colors px-5 py-2.5 text-sm font-medium"
        >
          Apply
        </button>
        <p className="text-sm text-cream/50 self-center">{formatRangeLabel(parseDateKey(from), parseDateKey(to))}</p>
        {error && <p className="w-full text-sm text-coral">{error}</p>}
      </form>
    </div>
  );
}
