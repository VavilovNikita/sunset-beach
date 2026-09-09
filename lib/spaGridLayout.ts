// Pure layout math for the spa's half-hour grid (components/admin/SpaScheduleGrid.tsx) - time-
// of-day slot columns and appointment column spans. Kept separate from React/fetch so it's
// testable independent of click wiring, same convention as lib/calendarLayout.ts for the
// booking calendar grid. Deliberately NOT reusing that file's day-column math: this grid's unit
// is a 30-minute slot within one fixed day, not a variable-length range of whole calendar days -
// forcing the two into one shape would be exactly the "copying the reference implementation
// badly" mistake, since a half-hour slot isn't a smaller day and never spans midnight here.
function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

function toHHMM(minutes: number): string {
  const h = Math.floor(minutes / 60)
    .toString()
    .padStart(2, "0");
  const m = (minutes % 60).toString().padStart(2, "0");
  return `${h}:${m}`;
}

// One column per slot in [openingTime, closingTime).
export function buildSlotColumns(openingTime: string, closingTime: string, slotMinutes: number): string[] {
  const start = toMinutes(openingTime);
  const end = toMinutes(closingTime);
  const columns: string[] = [];
  for (let t = start; t < end; t += slotMinutes) columns.push(toHHMM(t));
  return columns;
}

// Which column a time falls in, relative to openingTime - negative or past the last column means
// off-grid (the backend itself rejects booking there; this is only ever used to position an
// appointment the backend already accepted).
export function slotIndexOf(time: string, openingTime: string, slotMinutes: number): number {
  return Math.round((toMinutes(time) - toMinutes(openingTime)) / slotMinutes);
}

// How many whole slots an appointment spans, rounded up - a duration that isn't an exact
// multiple of slotMinutes still gets a visible width instead of rounding down to zero.
export function slotSpanOf(durationMinutes: number, slotMinutes: number): number {
  return Math.max(1, Math.ceil(durationMinutes / slotMinutes));
}
