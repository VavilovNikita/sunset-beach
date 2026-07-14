"use client";

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export type CalendarCell = {
  date: string; // YYYY-MM-DD
  content: React.ReactNode;
  className?: string;
  onClick?: () => void;
};

export default function PriceCalendar({
  monthLabel,
  firstWeekday,
  daysInMonth,
  cells,
  onPrevMonth,
  onNextMonth,
}: {
  monthLabel: string;
  /** getDay() of the 1st of the month (0=Sun..6=Sat) */
  firstWeekday: number;
  daysInMonth: number;
  cells: CalendarCell[];
  onPrevMonth: () => void;
  onNextMonth: () => void;
}) {
  const cellByDate = new Map(cells.map((c) => [c.date, c]));
  const leadingBlanks = Array.from({ length: firstWeekday }, (_, i) => i);

  return (
    <div className="bg-ink2/40 border border-cream/10 rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <button
          type="button"
          onClick={onPrevMonth}
          className="text-sm text-cream/60 hover:text-cream px-2 py-1"
        >
          ← Prev
        </button>
        <p className="font-display italic text-lg">{monthLabel}</p>
        <button
          type="button"
          onClick={onNextMonth}
          className="text-sm text-cream/60 hover:text-cream px-2 py-1"
        >
          Next →
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center">
        {WEEKDAY_LABELS.map((w) => (
          <div key={w} className="eyebrow text-cream/40 text-[0.6rem] py-1">
            {w}
          </div>
        ))}

        {leadingBlanks.map((i) => (
          <div key={`blank-${i}`} />
        ))}

        {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((day) => {
          const dateKey = cells[0]?.date.slice(0, 7)
            ? `${cells[0].date.slice(0, 7)}-${String(day).padStart(2, "0")}`
            : "";
          const cell = cellByDate.get(dateKey);
          return (
            <button
              key={day}
              type="button"
              onClick={cell?.onClick}
              disabled={!cell?.onClick}
              className={`aspect-square rounded-lg text-xs flex flex-col items-center justify-center gap-0.5 transition-colors ${
                cell?.className ?? "bg-cream/5 text-cream/70"
              }`}
            >
              <span className="text-[0.65rem] text-cream/40">{day}</span>
              {cell?.content}
            </button>
          );
        })}
      </div>
    </div>
  );
}
