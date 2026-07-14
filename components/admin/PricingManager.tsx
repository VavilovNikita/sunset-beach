"use client";

import { useEffect, useState } from "react";
import PriceCalendar, { type CalendarCell } from "@/components/admin/PriceCalendar";

type Room = { id: string; name: string };
type DayPrice = { date: string; price: number; isOverride: boolean };

const MONTH_FORMAT = new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric", timeZone: "UTC" });

function monthParam(monthDate: Date) {
  return `${monthDate.getUTCFullYear()}-${String(monthDate.getUTCMonth() + 1).padStart(2, "0")}`;
}

export default function PricingManager({ rooms }: { rooms: Room[] }) {
  const [roomId, setRoomId] = useState(rooms[0]?.id ?? "");
  const [monthDate, setMonthDate] = useState(() => {
    const now = new Date();
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  });
  const [days, setDays] = useState<DayPrice[]>([]);
  const [loading, setLoading] = useState(false);

  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [price, setPrice] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!roomId) return;
    setLoading(true);
    fetch(`/api/pricing/${roomId}?month=${monthParam(monthDate)}`)
      .then((res) => res.json())
      .then((data) => setDays(data.days ?? []))
      .finally(() => setLoading(false));
  }, [roomId, monthDate]);

  async function handleSetRange(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const res = await fetch(`/api/pricing/${roomId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ from, to, price: Number(price) }),
    });

    setSaving(false);

    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setError(data?.error ? JSON.stringify(data.error) : "Could not save prices.");
      return;
    }

    const refreshed = await fetch(`/api/pricing/${roomId}?month=${monthParam(monthDate)}`).then((r) => r.json());
    setDays(refreshed.days ?? []);
  }

  const daysInMonth = new Date(Date.UTC(monthDate.getUTCFullYear(), monthDate.getUTCMonth() + 1, 0)).getUTCDate();
  const firstWeekday = monthDate.getUTCDay();

  const cells: CalendarCell[] = days.map((d) => ({
    date: d.date,
    content: <span className={d.isOverride ? "text-coral font-medium" : "text-cream/70"}>฿{d.price.toLocaleString("en-US")}</span>,
    className: d.isOverride ? "bg-coral/10" : "bg-cream/5",
  }));

  return (
    <div className="grid lg:grid-cols-[1fr_320px] gap-8">
      <div>
        <div className="mb-4">
          <label className="eyebrow text-cream/60 block mb-1">Room</label>
          <select
            value={roomId}
            onChange={(e) => setRoomId(e.target.value)}
            className="bg-ink2 border border-cream/20 rounded-lg px-3 py-2 text-sm"
          >
            {rooms.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </div>

        {loading ? (
          <p className="text-sm text-cream/50">Loading…</p>
        ) : (
          <PriceCalendar
            monthLabel={MONTH_FORMAT.format(monthDate)}
            firstWeekday={firstWeekday}
            daysInMonth={daysInMonth}
            cells={cells}
            onPrevMonth={() => setMonthDate((d) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - 1, 1)))}
            onNextMonth={() => setMonthDate((d) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1)))}
          />
        )}
        <p className="mt-3 text-xs text-cream/40">Coral = manually set price. Otherwise showing the room&rsquo;s base price.</p>
      </div>

      <div>
        <h2 className="font-display italic text-lg mb-4">Set a price range</h2>
        <form onSubmit={handleSetRange} className="space-y-4 bg-ink2/40 border border-cream/10 rounded-xl p-5">
          <div>
            <label className="eyebrow text-cream/60 block mb-1">From</label>
            <input
              type="date"
              required
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="w-full bg-transparent border-b border-cream/25 py-2 text-cream text-sm focus:outline-none focus:border-coral"
            />
          </div>
          <div>
            <label className="eyebrow text-cream/60 block mb-1">To</label>
            <input
              type="date"
              required
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="w-full bg-transparent border-b border-cream/25 py-2 text-cream text-sm focus:outline-none focus:border-coral"
            />
          </div>
          <div>
            <label className="eyebrow text-cream/60 block mb-1">Price / night (฿)</label>
            <input
              type="number"
              min={0}
              step="1"
              required
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              className="w-full bg-transparent border-b border-cream/25 py-2 text-cream text-sm focus:outline-none focus:border-coral"
            />
          </div>

          {error && <p className="text-sm text-coral">{error}</p>}

          <button
            type="submit"
            disabled={saving}
            className="w-full rounded-full bg-coral hover:bg-coraldeep transition-colors py-2.5 text-sm font-medium disabled:opacity-60"
          >
            {saving ? "Saving…" : "Apply to range"}
          </button>
        </form>
      </div>
    </div>
  );
}
