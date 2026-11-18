import type {
  BookingTrackerMonth,
  BookingTrackerMonthTargetsInput,
  BookingTrackerSnapshot,
  BookingTrackerSnapshotUpdateInput,
} from "@/lib/types";

// Pure logic of the Booking tracker tab (/admin/reports?tab=tracker): the address parameters, the default
// season, the target form and the snapshot notes form, and the geometry of the SVG charts. Tested in
// bookingTracker.test.ts. Nothing here computes a money figure - every amount, share and total is the server's and is
// only formatted. The one number turned into a position is a chart's scale, which is drawing, not accounting.

export const MAX_TRACKER_MONTHS = 12;

const MONTH_KEY = /^(\d{4})-(0[1-9]|1[0-2])$/;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function isMonthKey(value: string | undefined | null): value is string {
  return !!value && MONTH_KEY.test(value);
}

// 2026-11 -> a running month number, so months can be compared and counted without a Date.
function monthIndex(key: string): number {
  const [, year, month] = MONTH_KEY.exec(key)!;
  return Number(year) * 12 + Number(month) - 1;
}

function monthFromIndex(index: number): string {
  const year = Math.floor(index / 12);
  return `${String(year).padStart(4, "0")}-${String((index % 12) + 1).padStart(2, "0")}`;
}

export function addMonths(key: string, count: number): string {
  return monthFromIndex(monthIndex(key) + count);
}

// Months from..to, both ends included.
export function monthsBetween(from: string, to: string): string[] {
  const out: string[] = [];
  for (let i = monthIndex(from); i <= monthIndex(to); i++) out.push(monthFromIndex(i));
  return out;
}

// "2026-11" -> "Nov 2026".
export function monthLabel(key: string): string {
  const m = MONTH_KEY.exec(key);
  return m ? `${MONTHS[Number(m[2]) - 1]} ${m[1]}` : key;
}

// The hotel's season is November to April. The one that contains today, or - May to October, when none does - the
// one that starts next. The server applies the same rule when no range is sent; this is for the form to start from and
// for "Current season" to link to. today is the hotel-local date key (hotelDateKey), passed in so this stays pure.
export function defaultSeason(today: string): { from: string; to: string } {
  const year = Number(today.slice(0, 4));
  const month = Number(today.slice(5, 7));
  const startYear = month <= 4 ? year - 1 : year;
  const from = `${String(startYear).padStart(4, "0")}-11`;
  return { from, to: addMonths(from, 5) };
}

// What the address carries. Absent means "not chosen": the server's default season (and every month) applies.
export type TrackerParams = { fromMonth?: string; toMonth?: string; stayMonth?: string };

export type TrackerParamsResult = { ok: true; params: TrackerParams } | { ok: false; error: string };

// One check for the form and the address. A range needs both ends, in order, at most 12 months; the stay month must lie
// inside it. Nothing at all is the default and is fine.
export function validateTrackerParams(fromMonth: string, toMonth: string, stayMonth: string): TrackerParamsResult {
  const from = fromMonth.trim();
  const to = toMonth.trim();
  const stay = stayMonth.trim();
  if (!from && !to) {
    if (stay) return { ok: false, error: "Choose the months first, then a stay month inside them." };
    return { ok: true, params: {} };
  }
  if (!isMonthKey(from) || !isMonthKey(to)) return { ok: false, error: "Choose both the first and the last month." };
  if (monthIndex(to) < monthIndex(from)) return { ok: false, error: "The last month must be on or after the first." };
  if (monthIndex(to) - monthIndex(from) + 1 > MAX_TRACKER_MONTHS) {
    return { ok: false, error: `At most ${MAX_TRACKER_MONTHS} months at a time.` };
  }
  if (stay) {
    if (!isMonthKey(stay) || monthIndex(stay) < monthIndex(from) || monthIndex(stay) > monthIndex(to)) {
      return { ok: false, error: "The stay month must be one of the months in the range." };
    }
    return { ok: true, params: { fromMonth: from, toMonth: to, stayMonth: stay } };
  }
  return { ok: true, params: { fromMonth: from, toMonth: to } };
}

// The ?fromMonth=&toMonth=&stayMonth= of the address. A hand-edited value that does not validate falls back to the
// default, like parseReportRange does for the other tabs.
export function parseTrackerParams(raw: { fromMonth?: string; toMonth?: string; stayMonth?: string }): TrackerParams {
  const result = validateTrackerParams(raw.fromMonth ?? "", raw.toMonth ?? "", raw.stayMonth ?? "");
  return result.ok ? result.params : {};
}

// The query string of GET /reports/booking-tracker (and its export): only what was chosen.
export function trackerQuery(params: TrackerParams): string {
  const q = new URLSearchParams();
  if (params.fromMonth) q.set("fromMonth", params.fromMonth);
  if (params.toMonth) q.set("toMonth", params.toMonth);
  if (params.stayMonth) q.set("stayMonth", params.stayMonth);
  return q.toString();
}

// --- The target form ---------------------------------------------------------------------------------------

// Typed as strings (an emptied field is "", i.e. cleared). Parsed once on save.
export type TargetsForm = { target: string; baselineNights: string; baselineNet: string };

export function targetsFormFrom(month: Pick<BookingTrackerMonth, "targetRoomNights" | "baselineRoomNights" | "baselineNetRevenue">): TargetsForm {
  return {
    target: month.targetRoomNights === null ? "" : String(month.targetRoomNights),
    baselineNights: month.baselineRoomNights === null ? "" : String(month.baselineRoomNights),
    baselineNet: month.baselineNetRevenue ?? "",
  };
}

export type TargetsParse =
  | { ok: true; input: BookingTrackerMonthTargetsInput }
  | { ok: false; errors: Partial<Record<keyof TargetsForm, string>> };

function wholeNumberOrNull(text: string, max: number): number | null | undefined {
  const t = text.trim();
  if (t === "") return null;
  if (!/^\d+$/.test(t)) return undefined;
  const n = Number(t);
  return n <= max ? n : undefined;
}

// Money typed by a person: digits with at most two decimals, a comma thousands separator or a stray space tolerated.
// The server's own pattern is ^\d{1,12}(\.\d{1,2})?$. Returned as the string the server wants - nothing is converted to
// a number, so no rounding can creep in.
export function normalizeBaht(text: string): string | null | undefined {
  const t = text.trim().replace(/[\s,]/g, "");
  if (t === "") return null;
  if (!/^\d{1,12}(\.\d{1,2})?$/.test(t)) return undefined;
  return t;
}

export function parseTargetsForm(form: TargetsForm): TargetsParse {
  const errors: Partial<Record<keyof TargetsForm, string>> = {};
  const target = wholeNumberOrNull(form.target, 100000);
  const baselineNights = wholeNumberOrNull(form.baselineNights, 100000);
  const baselineNet = normalizeBaht(form.baselineNet);
  if (target === undefined) errors.target = "A whole number from 0 to 100,000, or empty.";
  if (baselineNights === undefined) errors.baselineNights = "A whole number from 0 to 100,000, or empty.";
  if (baselineNet === undefined) errors.baselineNet = "An amount with at most two decimals, or empty.";
  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return {
    ok: true,
    input: {
      targetRoomNights: target as number | null,
      baselineRoomNights: baselineNights as number | null,
      baselineNetRevenue: baselineNet as string | null,
    },
  };
}

// "1234.5" and "1234.50" are the same amount; compared as whole satang so nothing goes through a float.
function satang(amount: string | null): number | null {
  if (amount === null) return null;
  const [whole, frac = ""] = amount.split(".");
  return Number(whole) * 100 + Number((frac + "00").slice(0, 2));
}

// Whether the form differs from what is saved. An unparseable form counts as changed (the save will say what is wrong).
export function targetsDirty(
  saved: Pick<BookingTrackerMonth, "targetRoomNights" | "baselineRoomNights" | "baselineNetRevenue">,
  form: TargetsForm,
): boolean {
  const parsed = parseTargetsForm(form);
  if (!parsed.ok) return true;
  return (
    parsed.input.targetRoomNights !== saved.targetRoomNights ||
    parsed.input.baselineRoomNights !== saved.baselineRoomNights ||
    satang(parsed.input.baselineNetRevenue) !== satang(saved.baselineNetRevenue)
  );
}

// --- The snapshot notes form --------------------------------------------------------------------------------

export type NotesForm = { reason: string; nextAction: string; owner: string; dueDate: string };

export const NOTE_LIMITS = { reason: 500, nextAction: 500, owner: 120 } as const;

export function notesFormFrom(s: Pick<BookingTrackerSnapshot, "reason" | "nextAction" | "owner" | "dueDate">): NotesForm {
  return { reason: s.reason ?? "", nextAction: s.nextAction ?? "", owner: s.owner ?? "", dueDate: s.dueDate ?? "" };
}

const clean = (text: string) => text.trim();

// The PATCH body: only the fields that changed (an empty one clears it). Empty when nothing changed - the caller sends
// nothing then, and the server would write nothing either.
export function notesPatch(
  saved: Pick<BookingTrackerSnapshot, "reason" | "nextAction" | "owner" | "dueDate">,
  form: NotesForm,
): BookingTrackerSnapshotUpdateInput {
  const patch: BookingTrackerSnapshotUpdateInput = {};
  if (clean(form.reason) !== (saved.reason ?? "")) patch.reason = clean(form.reason) || null;
  if (clean(form.nextAction) !== (saved.nextAction ?? "")) patch.nextAction = clean(form.nextAction) || null;
  if (clean(form.owner) !== (saved.owner ?? "")) patch.owner = clean(form.owner) || null;
  if (form.dueDate !== (saved.dueDate ?? "")) patch.dueDate = form.dueDate || null;
  return patch;
}

export function notesDirty(saved: Pick<BookingTrackerSnapshot, "reason" | "nextAction" | "owner" | "dueDate">, form: NotesForm): boolean {
  return Object.keys(notesPatch(saved, form)).length > 0;
}

// A note over the server's limit would be a 400; said on screen first.
export function notesError(form: NotesForm): string | null {
  if (clean(form.reason).length > NOTE_LIMITS.reason) return `Reason / issue: at most ${NOTE_LIMITS.reason} characters.`;
  if (clean(form.nextAction).length > NOTE_LIMITS.nextAction) return `Next action: at most ${NOTE_LIMITS.nextAction} characters.`;
  if (clean(form.owner).length > NOTE_LIMITS.owner) return `Owner: at most ${NOTE_LIMITS.owner} characters.`;
  return null;
}

// --- Charts ------------------------------------------------------------------------------------------------

// A chart is drawn from the server's own figures; only their scale is worked out here. Values arrive as numbers or the
// server's decimal strings.
export type ChartBox = { width: number; height: number; left: number; right: number; top: number; bottom: number };

export const DEFAULT_CHART_BOX: ChartBox = { width: 640, height: 240, left: 56, right: 12, top: 12, bottom: 44 };

const toNumber = (v: number | string) => (typeof v === "number" ? v : Number(v));

// The top of the value axis: the largest value rounded up to 1, 2, 2.5 or 5 times a power of ten, so the ticks are
// round. Never below 1, so an all-zero chart still has an axis.
export function niceMax(max: number): number {
  if (!(max > 0)) return 1;
  const pow = Math.pow(10, Math.floor(Math.log10(max)));
  for (const step of [1, 2, 2.5, 5, 10]) {
    if (max <= step * pow) return step * pow;
  }
  return 10 * pow;
}

export function axisTicks(top: number, count = 4): number[] {
  return Array.from({ length: count + 1 }, (_, i) => (top * i) / count);
}

export type BarShape = { x: number; y: number; width: number; height: number };

// One column per value, evenly spaced, the first at the left; heights scale to niceMax over the plot area.
export function barLayout(values: Array<number | string>, box: ChartBox = DEFAULT_CHART_BOX): { top: number; bars: BarShape[] } {
  const nums = values.map(toNumber).map((n) => (Number.isFinite(n) && n > 0 ? n : 0));
  const top = niceMax(Math.max(0, ...nums));
  const plotW = box.width - box.left - box.right;
  const plotH = box.height - box.top - box.bottom;
  const slot = nums.length > 0 ? plotW / nums.length : plotW;
  const barW = slot * 0.62;
  return {
    top,
    bars: nums.map((n, i) => {
      const h = (n / top) * plotH;
      return { x: box.left + slot * i + (slot - barW) / 2, y: box.top + plotH - h, width: barW, height: h };
    }),
  };
}

export type LinePoint = { x: number; y: number };

// One point per value, spread across the plot width (a single value sits in the middle).
export function lineLayout(values: Array<number | string>, box: ChartBox = DEFAULT_CHART_BOX): { top: number; points: LinePoint[] } {
  const nums = values.map(toNumber).map((n) => (Number.isFinite(n) && n > 0 ? n : 0));
  const top = niceMax(Math.max(0, ...nums));
  const plotW = box.width - box.left - box.right;
  const plotH = box.height - box.top - box.bottom;
  return {
    top,
    points: nums.map((n, i) => ({
      x: nums.length === 1 ? box.left + plotW / 2 : box.left + (plotW * i) / (nums.length - 1),
      y: box.top + plotH - (n / top) * plotH,
    })),
  };
}

export function polylinePoints(points: LinePoint[]): string {
  return points.map((p) => `${round1(p.x)},${round1(p.y)}`).join(" ");
}

const round1 = (n: number) => Math.round(n * 10) / 10;

// --- Display ----------------------------------------------------------------------------------------------

// A server money string with its two decimals kept (the tracker is cents-exact, unlike lib/reports.ts#formatBaht, which
// drops trailing zeros). Formatting only - the amount is never converted back to a number to be used.
export function formatBahtCents(amount: string | null): string {
  if (amount === null) return "—";
  return `฿${Number(amount).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function formatCount(value: number | null): string {
  return value === null ? "—" : value.toLocaleString("en-US");
}

// A signed count for a difference the server computed (pickup): "+4", "−2", "0".
export function formatSigned(value: number | null): string {
  if (value === null) return "—";
  if (value > 0) return `+${value.toLocaleString("en-US")}`;
  if (value < 0) return `−${Math.abs(value).toLocaleString("en-US")}`;
  return "0";
}

export function formatSignedBaht(amount: string | null): string {
  if (amount === null) return "—";
  const negative = amount.startsWith("-");
  const text = formatBahtCents(negative ? amount.slice(1) : amount);
  if (negative) return `−${text}`;
  return Number(amount) > 0 ? `+${text}` : text;
}
