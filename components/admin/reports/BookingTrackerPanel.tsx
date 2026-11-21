"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  formatBahtCents,
  formatCount,
  formatSigned,
  formatSignedBaht,
  monthLabel,
  monthsBetween,
  notesDirty,
  notesError,
  notesFormFrom,
  notesPatch,
  NOTE_LIMITS,
  parseTargetsForm,
  targetsDirty,
  targetsFormFrom,
  validateTrackerParams,
  type NotesForm,
  type TargetsForm,
  type TrackerParams,
} from "@/lib/bookingTracker";
import { downloadTrackerExport, saveMonthTargets, saveSnapshotNotes } from "@/lib/bookingTrackerClient";
import { BOOKING_CHANNEL_LABELS } from "@/lib/bookingChannel";
import { formatDate, formatTimestamp } from "@/lib/formatDate";
import { formatPercent } from "@/lib/reports";
import { reportsHref, type ReportsState } from "@/lib/reportsTabs";
import { useSavedNotice } from "@/lib/useSavedNotice";
import type { BookingTrackerMonth, BookingTrackerReport, BookingTrackerSnapshot } from "@/lib/types";
import { BarChart, LineChart } from "@/components/admin/reports/TrackerCharts";
import { normalizeMoneyInput } from "@/lib/moneyInput";

// The Booking tracker tab: the hotel's Excel workbook on real data. The server sends every figure; this only lays them
// out, takes the typed targets and notes, and keeps the last good figures on screen when a reload fails.

type Loaded = { ok: true; data: BookingTrackerReport } | { ok: false; error: string };

const th = "px-3 py-2 font-normal eyebrow text-cream/50";
const td = "px-3 py-2";
const num = "text-right tabular-nums";
const fieldClass = "bg-transparent border-b border-cream/25 py-1 text-cream text-sm focus:outline-none focus:border-coral";
const buttonClass = "rounded-full border border-cream/20 hover:border-coral px-3 py-1 text-xs disabled:opacity-50 disabled:hover:border-cream/20";

export default function BookingTrackerPanel({ result, state, today }: { result: Loaded; state: ReportsState; today: string }) {
  const router = useRouter();
  const [shown, setShown] = useState<BookingTrackerReport | null>(result.ok ? result.data : null);
  const [loadError, setLoadError] = useState<string | null>(result.ok ? null : result.error);
  const [loadedAt, setLoadedAt] = useState<string>(new Date().toISOString());
  const [pending, startTransition] = useTransition();

  // A reload that fails keeps the last figures and says so; a good one replaces them.
  useEffect(() => {
    if (result.ok) {
      setShown(result.data);
      setLoadError(null);
      setLoadedAt(new Date().toISOString());
    } else {
      setLoadError(result.error);
    }
  }, [result]);

  const refresh = () => startTransition(() => router.refresh());

  return (
    <div>
      <p className="text-sm text-cream/60 mb-6">
        The booking tracker workbook, from live bookings. Counted bookings are Confirmed and Paid - enquiries (New),
        cancelled bookings and no-shows are not. A stay is split by its nights at the price agreed for each night. Room
        prices include service charge and VAT; both are taken out here for this analysis only - nothing is charged to a
        guest.
      </p>

      <RangeForm
        key={`${shown?.fromMonth}|${shown?.toMonth}|${shown?.stayMonth}`}
        shown={shown}
        state={state}
        today={today}
        pending={pending}
        onApply={(href) => startTransition(() => router.replace(href))}
      />

      {loadError && (
        <p role="alert" className="text-sm text-coral mb-6">
          {shown
            ? `Couldn't reload the booking tracker (${loadError}). Showing the figures from ${formatTimestamp(loadedAt)}.`
            : `Couldn't load the booking tracker: ${loadError}`}
        </p>
      )}

      {shown && (
        <>
          <ExportButton report={shown} />
          <ResultsSection report={shown} onSaved={refresh} />
          <ChannelSection report={shown} />
          <TrendsSection report={shown} />
          <WeeklyReviewSection report={shown} onSaved={refresh} />
          <p className="text-xs text-cream/40 mt-8">
            As at {formatDate(shown.positionDate)} (hotel time). VAT {shown.vatRate}%, service charge {shown.serviceChargeRate}%.
            An early-departure fee has no night, so it is left out - the same as the revenue statistic (Z410) leaves it out.
            Available room nights are today&apos;s rooms over the nights of the month, less the nights a room is blocked.
          </p>
        </>
      )}
    </div>
  );
}

// --- Range form ----------------------------------------------------------------------------------------------

function RangeForm({
  shown,
  state,
  today,
  pending,
  onApply,
}: {
  shown: BookingTrackerReport | null;
  state: ReportsState;
  today: string;
  pending: boolean;
  onApply: (href: string) => void;
}) {
  const [from, setFrom] = useState(state.fromMonth ?? shown?.fromMonth ?? "");
  const [to, setTo] = useState(state.toMonth ?? shown?.toMonth ?? "");
  const [stay, setStay] = useState(state.stayMonth ?? "");
  const [error, setError] = useState<string | null>(null);

  const rangeOk = validateTrackerParams(from, to, "").ok && from !== "" && to !== "";
  const stayOptions = rangeOk ? monthsBetween(from, to) : shown ? monthsBetween(shown.fromMonth, shown.toMonth) : [];

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const result = validateTrackerParams(from, to, stay);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setError(null);
    onApply(reportsHref(state, { fromMonth: result.params.fromMonth, toMonth: result.params.toMonth, stayMonth: result.params.stayMonth }));
  }

  return (
    <form onSubmit={submit} className="flex flex-wrap items-end gap-3 mb-6">
      <div>
        <label className="eyebrow text-cream/60 block mb-1" htmlFor="tracker-from">
          From month
        </label>
        <input id="tracker-from" type="month" value={from} onChange={(e) => setFrom(e.target.value)} className={fieldClass} />
      </div>
      <div>
        <label className="eyebrow text-cream/60 block mb-1" htmlFor="tracker-to">
          To month
        </label>
        <input id="tracker-to" type="month" value={to} onChange={(e) => setTo(e.target.value)} className={fieldClass} />
      </div>
      <div>
        <label className="eyebrow text-cream/60 block mb-1" htmlFor="tracker-stay">
          Channels and trends for
        </label>
        <select id="tracker-stay" value={stay} onChange={(e) => setStay(e.target.value)} className="bg-ink2 border border-cream/20 rounded-lg px-3 py-1.5 text-sm">
          <option value="">All stays in the range</option>
          {stayOptions.map((m) => (
            <option key={m} value={m}>
              {monthLabel(m)}
            </option>
          ))}
        </select>
      </div>
      <button type="submit" disabled={pending} className="rounded-full border border-cream/20 hover:border-coral px-4 py-2 text-sm disabled:opacity-60">
        {pending ? "Loading…" : "View"}
      </button>
      {(state.fromMonth || state.toMonth || state.stayMonth) && (
        <Link
          href={reportsHref(state, { fromMonth: undefined, toMonth: undefined, stayMonth: undefined })}
          className="text-sm text-cream/60 hover:text-coral py-2"
          title={`The season that contains ${formatDate(today)}`}
        >
          Current season
        </Link>
      )}
      {error && <p role="alert" className="w-full text-xs text-coral">{error}</p>}
    </form>
  );
}

// --- Export ------------------------------------------------------------------------------------------------

function ExportButton({ report }: { report: BookingTrackerReport }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setBusy(true);
    setError(null);
    const result = await downloadTrackerExport({
      fromMonth: report.fromMonth,
      toMonth: report.toMonth,
      stayMonth: report.stayMonth ?? undefined,
    });
    setBusy(false);
    if (!result.ok) setError(result.error);
  }

  return (
    <div className="flex items-center gap-3 mb-8">
      <button type="button" onClick={run} disabled={busy} className="rounded-full bg-coral hover:bg-coraldeep transition-colors px-5 py-2 text-sm font-medium disabled:opacity-60">
        {busy ? "Preparing…" : "Export xlsx"}
      </button>
      <span className="text-xs text-cream/40">
        Results, Channel summary, Booking trends, Weekly review and a Bookings sheet, with charts.
      </span>
      {error && <span role="alert" className="text-xs text-coral">{error}</span>}
    </div>
  );
}

// --- Results -------------------------------------------------------------------------------------------------

function ResultsSection({ report, onSaved }: { report: BookingTrackerReport; onSaved: () => void }) {
  const rows = [...report.months, report.total];
  return (
    <section className="mb-10">
      <h2 className="font-display italic text-xl mb-1">Results</h2>
      <p className="text-xs text-cream/40 mb-3">
        {monthLabel(report.fromMonth)} to {monthLabel(report.toMonth)}. Occupancy is booked over available room nights.
      </p>

      <div className="border border-cream/10 rounded-xl overflow-x-auto mb-6">
        <table className="w-full text-sm">
          <thead className="text-left">
            <tr className="border-b border-cream/10">
              <th className={th}>Month</th>
              <th className={`${th} ${num}`}>Available</th>
              <th className={`${th} ${num}`}>Booked</th>
              <th className={`${th} ${num}`}>Occupancy</th>
              <th className={`${th} ${num}`}>Net room revenue</th>
              <th className={`${th} ${num}`}>Breakfast</th>
              <th className={`${th} ${num}`}>Net ADR</th>
              <th className={`${th} ${num}`}>Target</th>
              <th className={`${th} ${num}`}>Still needed</th>
              <th className={`${th} ${num}`}>Pickup vs baseline</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-cream/10">
            {rows.map((m) => (
              <tr key={m.month ?? "total"} className={m.month === null ? "border-t border-cream/20 font-medium" : ""}>
                <td className={td}>{m.month ? monthLabel(m.month) : "Total"}</td>
                <td className={`${td} ${num}`}>{formatCount(m.availableRoomNights)}</td>
                <td className={`${td} ${num}`}>{formatCount(m.bookedRoomNights)}</td>
                <td className={`${td} ${num}`}>{formatPercent(m.occupancyPercent)}</td>
                <td className={`${td} ${num}`}>{formatBahtCents(m.netRoomRevenue)}</td>
                <td className={`${td} ${num}`}>{formatBahtCents(m.breakfastRevenue)}</td>
                <td className={`${td} ${num}`}>{formatBahtCents(m.netAdr)}</td>
                <td className={`${td} ${num}`}>{formatCount(m.targetRoomNights)}</td>
                <td className={`${td} ${num}`}>{formatCount(m.stillNeededRoomNights)}</td>
                <td className={`${td} ${num}`}>{formatSigned(m.pickupVsBaseline)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h3 className="eyebrow text-cream/60 mb-2">Breakdown</h3>
      <div className="border border-cream/10 rounded-xl overflow-x-auto mb-6">
        <table className="w-full text-sm">
          <thead className="text-left">
            <tr className="border-b border-cream/10">
              <th className={th}>Month</th>
              <th className={`${th} ${num}`}>Inclusive package</th>
              <th className={`${th} ${num}`}>Service charge</th>
              <th className={`${th} ${num}`}>VAT</th>
              <th className={`${th} ${num}`}>Breakfast</th>
              <th className={`${th} ${num}`}>Net room revenue</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-cream/10">
            {rows.map((m) => (
              <tr key={m.month ?? "total"} className={m.month === null ? "border-t border-cream/20 font-medium" : ""}>
                <td className={td}>{m.month ? monthLabel(m.month) : "Total"}</td>
                <td className={`${td} ${num}`}>{formatBahtCents(m.grossRevenue)}</td>
                <td className={`${td} ${num}`}>{formatBahtCents(m.serviceCharge)}</td>
                <td className={`${td} ${num}`}>{formatBahtCents(m.vat)}</td>
                <td className={`${td} ${num}`}>{formatBahtCents(m.breakfastRevenue)}</td>
                <td className={`${td} ${num}`}>{formatBahtCents(m.netRoomRevenue)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h3 className="eyebrow text-cream/60 mb-2">Inputs</h3>
      <p className="text-xs text-cream/40 mb-2">
        Rooms, nights and blocked nights come from the system. Target and baseline are typed here and saved per month; an
        empty field is cleared.
      </p>
      <div className="border border-cream/10 rounded-xl overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left">
            <tr className="border-b border-cream/10">
              <th className={th}>Month</th>
              <th className={`${th} ${num}`}>Rooms</th>
              <th className={`${th} ${num}`}>Nights</th>
              <th className={`${th} ${num}`}>Blocked</th>
              <th className={th}>Target room nights</th>
              <th className={th}>Baseline room nights</th>
              <th className={th}>Baseline net revenue</th>
              <th className={th} />
            </tr>
          </thead>
          <tbody className="divide-y divide-cream/10">
            {report.months.map((m) => (
              <InputsRow key={m.month} month={m} onSaved={onSaved} />
            ))}
            <tr className="border-t border-cream/20 font-medium">
              <td className={td}>Total</td>
              <td className={`${td} ${num}`}>—</td>
              <td className={`${td} ${num}`}>{formatCount(report.total.nightsInMonth)}</td>
              <td className={`${td} ${num}`}>{formatCount(report.total.blockedRoomNights)}</td>
              <td className={`${td}`}>{formatCount(report.total.targetRoomNights)}</td>
              <td className={`${td}`}>{formatCount(report.total.baselineRoomNights)}</td>
              <td className={`${td}`}>{formatBahtCents(report.total.baselineNetRevenue)}</td>
              <td className={td} />
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  );
}

function InputsRow({ month, onSaved }: { month: BookingTrackerMonth; onSaved: () => void }) {
  const key = month.month as string;
  const [form, setForm] = useState<TargetsForm>(targetsFormFrom(month));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, showNotice, clearNotice] = useSavedNotice();

  // The saved values changed (a save, a reload): the fields show them again.
  useEffect(() => {
    setForm(targetsFormFrom(month));
  }, [month.targetRoomNights, month.baselineRoomNights, month.baselineNetRevenue]); // eslint-disable-line react-hooks/exhaustive-deps

  const dirty = targetsDirty(month, form);
  const parsed = parseTargetsForm(form);
  const fieldErrors = parsed.ok ? {} : parsed.errors;

  async function save() {
    if (!parsed.ok) {
      setError(Object.values(parsed.errors)[0] ?? "Check the figures.");
      return;
    }
    setSaving(true);
    setError(null);
    clearNotice();
    const result = await saveMonthTargets(key, parsed.input);
    setSaving(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    showNotice("Saved.");
    onSaved();
  }

  const input = (name: keyof TargetsForm, label: string, width: string) => (
    <input
      aria-label={`${label} for ${monthLabel(key)}`}
      aria-invalid={fieldErrors[name] ? true : undefined}
      title={fieldErrors[name]}
      inputMode="decimal"
      value={form[name]}
      onChange={(e) => setForm({ ...form, [name]: normalizeMoneyInput(e.target.value) })}
      className={`${fieldClass} ${width} ${fieldErrors[name] ? "border-coral" : ""}`}
    />
  );

  return (
    <tr>
      <td className={td}>{monthLabel(key)}</td>
      <td className={`${td} ${num}`}>{formatCount(month.physicalRooms)}</td>
      <td className={`${td} ${num}`}>{formatCount(month.nightsInMonth)}</td>
      <td className={`${td} ${num}`}>{formatCount(month.blockedRoomNights)}</td>
      <td className={td}>{input("target", "Target room nights", "w-24")}</td>
      <td className={td}>{input("baselineNights", "Baseline room nights", "w-24")}</td>
      <td className={td}>{input("baselineNet", "Baseline net revenue", "w-32")}</td>
      <td className={`${td} whitespace-nowrap`}>
        <button type="button" onClick={save} disabled={!dirty || saving} className={buttonClass}>
          {saving ? "Saving…" : "Save"}
        </button>
        {notice && <span role="status" className="text-xs text-cream/60 ml-2">✓ {notice}</span>}
        {error && <p role="alert" className="text-xs text-coral mt-1 max-w-[16rem] whitespace-normal">{error}</p>}
      </td>
    </tr>
  );
}

// --- Channel summary -----------------------------------------------------------------------------------------

function filterLabel(report: BookingTrackerReport): string {
  return report.stayMonth ? `${monthLabel(report.stayMonth)} stays` : `all stays, ${monthLabel(report.fromMonth)} to ${monthLabel(report.toMonth)}`;
}

function ChannelSection({ report }: { report: BookingTrackerReport }) {
  const { rows, total, ranking } = report.channels;
  const label = (c: (typeof rows)[number]["channel"]) => (c ? BOOKING_CHANNEL_LABELS[c] : "Total");
  return (
    <section className="mb-10">
      <h2 className="font-display italic text-xl mb-1">Channel summary</h2>
      <p className="text-xs text-cream/40 mb-3">{filterLabel(report)}. Shares are of this selection&apos;s total.</p>
      <div className="border border-cream/10 rounded-xl overflow-x-auto mb-6">
        <table className="w-full text-sm">
          <thead className="text-left">
            <tr className="border-b border-cream/10">
              <th className={th}>Channel</th>
              <th className={`${th} ${num}`}>Room nights</th>
              <th className={`${th} ${num}`}>Net room revenue</th>
              <th className={`${th} ${num}`}>Net ADR</th>
              <th className={`${th} ${num}`}>Night share</th>
              <th className={`${th} ${num}`}>Revenue share</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-cream/10">
            {[...rows, total].map((r) => (
              <tr key={r.channel ?? "total"} className={r.channel === null ? "border-t border-cream/20 font-medium" : r.roomNights === 0 ? "text-cream/40" : ""}>
                <td className={td}>{label(r.channel)}</td>
                <td className={`${td} ${num}`}>{formatCount(r.roomNights)}</td>
                <td className={`${td} ${num}`}>{formatBahtCents(r.netRoomRevenue)}</td>
                <td className={`${td} ${num}`}>{formatBahtCents(r.netAdr)}</td>
                <td className={`${td} ${num}`}>{formatPercent(r.roomNightSharePercent)}</td>
                <td className={`${td} ${num}`}>{formatPercent(r.revenueSharePercent)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h3 className="eyebrow text-cream/60 mb-2">Ranked by net room revenue</h3>
      {ranking.length === 0 ? (
        <p className="text-sm text-cream/50">No room nights in this selection.</p>
      ) : (
        <div className="border border-cream/10 rounded-xl overflow-x-auto mb-6">
          <table className="w-full text-sm">
            <thead className="text-left">
              <tr className="border-b border-cream/10">
                <th className={`${th} ${num} w-16`}>Rank</th>
                <th className={th}>Channel</th>
                <th className={`${th} ${num}`}>Net room revenue</th>
                <th className={`${th} ${num}`}>Room nights</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-cream/10">
              {ranking.map((r) => (
                <tr key={r.channel}>
                  <td className={`${td} ${num}`}>{r.rank}</td>
                  <td className={td}>{BOOKING_CHANNEL_LABELS[r.channel]}</td>
                  <td className={`${td} ${num}`}>{formatBahtCents(r.netRoomRevenue)}</td>
                  <td className={`${td} ${num}`}>{formatCount(r.roomNights)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <BarChart
          title="Net room revenue by channel, ranked"
          unit="THB"
          tick={(v) => v.toLocaleString("en-US")}
          items={ranking.map((r) => ({ label: BOOKING_CHANNEL_LABELS[r.channel], value: r.netRoomRevenue, text: formatBahtCents(r.netRoomRevenue) }))}
        />
        <BarChart
          title="Room nights by channel"
          unit="room nights"
          items={rows.filter((r) => r.roomNights > 0).map((r) => ({ label: label(r.channel), value: r.roomNights, text: formatCount(r.roomNights) }))}
        />
      </div>
    </section>
  );
}

// --- Booking trends ------------------------------------------------------------------------------------------

function TrendsSection({ report }: { report: BookingTrackerReport }) {
  const { averageBookingWindowDays, buckets, weeks } = report.trends;
  return (
    <section className="mb-10">
      <h2 className="font-display italic text-xl mb-1">Booking trends</h2>
      <p className="text-xs text-cream/40 mb-3">
        {filterLabel(report)}. Booking window is arrival minus the day the booking was made (SiteMinder&apos;s own booked-on
        time where it has one), counted over the room nights inside the selection.
      </p>
      <p className="text-sm mb-4">
        Average booking window:{" "}
        <span className="text-cream">{averageBookingWindowDays === null ? "—" : `${averageBookingWindowDays} days`}</span>{" "}
        <span className="text-cream/40">(weighted by room nights)</span>
      </p>

      <div className="grid gap-4 lg:grid-cols-2 mb-6">
        <div className="border border-cream/10 rounded-xl overflow-x-auto self-start">
          <table className="w-full text-sm">
            <thead className="text-left">
              <tr className="border-b border-cream/10">
                <th className={th}>Window (days)</th>
                <th className={`${th} ${num}`}>Room nights</th>
                <th className={`${th} ${num}`}>Net room revenue</th>
                <th className={`${th} ${num}`}>Share</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-cream/10">
              {buckets.map((b) => (
                <tr key={b.label}>
                  <td className={td}>{b.label}</td>
                  <td className={`${td} ${num}`}>{formatCount(b.roomNights)}</td>
                  <td className={`${td} ${num}`}>{formatBahtCents(b.netRoomRevenue)}</td>
                  <td className={`${td} ${num}`}>{formatPercent(b.roomNightSharePercent)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <BarChart
          title="Room nights by booking window"
          unit="room nights"
          items={buckets.map((b) => ({ label: b.label, value: b.roomNights, text: formatCount(b.roomNights) }))}
        />
      </div>

      <h3 className="eyebrow text-cream/60 mb-2">Booking pace, last {weeks.length} weeks</h3>
      <p className="text-xs text-cream/40 mb-2">Room nights and net revenue of the bookings made in each week (Monday start).</p>
      <div className="grid gap-4 lg:grid-cols-2">
        <LineChart
          title="Room nights booked per week"
          unit="room nights"
          items={weeks.map((w) => ({ label: formatDate(w.weekStart).slice(0, -5), value: w.roomNights, text: formatCount(w.roomNights) }))}
        />
        <LineChart
          title="Net room revenue booked per week"
          unit="THB"
          tick={(v) => v.toLocaleString("en-US")}
          items={weeks.map((w) => ({ label: formatDate(w.weekStart).slice(0, -5), value: w.netRoomRevenue, text: formatBahtCents(w.netRoomRevenue) }))}
        />
      </div>
      <div className="border border-cream/10 rounded-xl overflow-x-auto mt-4">
        <table className="w-full text-sm">
          <thead className="text-left">
            <tr className="border-b border-cream/10">
              <th className={th}>Week of</th>
              <th className={`${th} ${num}`}>Room nights</th>
              <th className={`${th} ${num}`}>Net room revenue</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-cream/10">
            {weeks.map((w) => (
              <tr key={w.weekStart}>
                <td className={td}>{formatDate(w.weekStart)}</td>
                <td className={`${td} ${num}`}>{formatCount(w.roomNights)}</td>
                <td className={`${td} ${num}`}>{formatBahtCents(w.netRoomRevenue)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

// --- Weekly review -------------------------------------------------------------------------------------------

function WeeklyReviewSection({ report, onSaved }: { report: BookingTrackerReport; onSaved: () => void }) {
  return (
    <section className="mb-4">
      <h2 className="font-display italic text-xl mb-1">Weekly review</h2>
      <p className="text-xs text-cream/40 mb-3">
        A snapshot of every stay month is taken each Friday at 23:55 and never recomputed; pickup is the change since the
        previous snapshot of the same month. The notes beside it are yours to edit.
      </p>
      {report.weeklyReview.length === 0 ? (
        <p className="text-sm text-cream/50">No snapshot for these months yet - the first one is taken on the coming Friday night.</p>
      ) : (
        <div className="border border-cream/10 rounded-xl overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left">
              <tr className="border-b border-cream/10">
                <th className={th}>Snapshot</th>
                <th className={th}>Month</th>
                <th className={`${th} ${num}`}>Room nights</th>
                <th className={`${th} ${num}`}>Net room revenue</th>
                <th className={`${th} ${num}`}>Occupancy</th>
                <th className={`${th} ${num}`}>Pickup nights</th>
                <th className={`${th} ${num}`}>Pickup revenue</th>
                <th className={th}>Reason / issue</th>
                <th className={th}>Next action</th>
                <th className={th}>Owner</th>
                <th className={th}>Due</th>
                <th className={th} />
              </tr>
            </thead>
            <tbody className="divide-y divide-cream/10">
              {report.weeklyReview.map((s) => (
                <SnapshotRow key={s.id} snapshot={s} onSaved={onSaved} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function SnapshotRow({ snapshot, onSaved }: { snapshot: BookingTrackerSnapshot; onSaved: () => void }) {
  const [form, setForm] = useState<NotesForm>(notesFormFrom(snapshot));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, showNotice, clearNotice] = useSavedNotice();

  useEffect(() => {
    setForm(notesFormFrom(snapshot));
  }, [snapshot.reason, snapshot.nextAction, snapshot.owner, snapshot.dueDate]); // eslint-disable-line react-hooks/exhaustive-deps

  const dirty = notesDirty(snapshot, form);

  async function save() {
    const problem = notesError(form);
    if (problem) {
      setError(problem);
      return;
    }
    setSaving(true);
    setError(null);
    clearNotice();
    const result = await saveSnapshotNotes(snapshot.id, notesPatch(snapshot, form));
    setSaving(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    showNotice("Saved.");
    onSaved();
  }

  const text = (name: keyof NotesForm, label: string, width: string, max?: number) => (
    <input
      aria-label={`${label}, ${snapshot.stayMonth} snapshot of ${snapshot.snapshotDate}`}
      value={form[name]}
      maxLength={max ? max + 50 : undefined}
      onChange={(e) => setForm({ ...form, [name]: e.target.value })}
      className={`${fieldClass} ${width}`}
    />
  );

  return (
    <tr className="align-top">
      <td className={`${td} whitespace-nowrap`}>
        {formatDate(snapshot.snapshotDate)}
        {snapshot.late && (
          <span className="text-xs text-cream/50 italic ml-1" title="Taken after Friday 23:55, as at the moment the server caught up">
            late
          </span>
        )}
      </td>
      <td className={td}>{monthLabel(snapshot.stayMonth)}</td>
      <td className={`${td} ${num}`}>{formatCount(snapshot.roomNights)}</td>
      <td className={`${td} ${num}`}>{formatBahtCents(snapshot.netRoomRevenue)}</td>
      <td className={`${td} ${num}`}>{formatPercent(snapshot.occupancyPercent)}</td>
      <td className={`${td} ${num}`}>{formatSigned(snapshot.pickupRoomNights)}</td>
      <td className={`${td} ${num}`}>{formatSignedBaht(snapshot.pickupNetRevenue)}</td>
      <td className={td}>{text("reason", "Reason / issue", "w-48", NOTE_LIMITS.reason)}</td>
      <td className={td}>{text("nextAction", "Next action", "w-48", NOTE_LIMITS.nextAction)}</td>
      <td className={td}>{text("owner", "Owner", "w-28", NOTE_LIMITS.owner)}</td>
      <td className={td}>
        <input
          type="date"
          aria-label={`Due date, ${snapshot.stayMonth} snapshot of ${snapshot.snapshotDate}`}
          value={form.dueDate}
          onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
          className={fieldClass}
        />
      </td>
      <td className={`${td} whitespace-nowrap`}>
        <button type="button" onClick={save} disabled={!dirty || saving} className={buttonClass}>
          {saving ? "Saving…" : "Save"}
        </button>
        {notice && <span role="status" className="text-xs text-cream/60 ml-2">✓ {notice}</span>}
        {error && <p role="alert" className="text-xs text-coral mt-1 max-w-[16rem] whitespace-normal">{error}</p>}
      </td>
    </tr>
  );
}
