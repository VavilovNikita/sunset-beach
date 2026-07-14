"use client";

import { useEffect, useState } from "react";
import PriceCalendar, { type CalendarCell } from "@/components/admin/PriceCalendar";

type Room = { id: string; name: string };
type DayAvailability = { date: string; isBlocked: boolean; source: "booking" | "manual" | null };

const MONTH_FORMAT = new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric", timeZone: "UTC" });

function monthParam(monthDate: Date) {
  return `${monthDate.getUTCFullYear()}-${String(monthDate.getUTCMonth() + 1).padStart(2, "0")}`;
}

export default function AvailabilityManager({ rooms }: { rooms: Room[] }) {
  const [roomId, setRoomId] = useState(rooms[0]?.id ?? "");
  const [monthDate, setMonthDate] = useState(() => {
    const now = new Date();
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  });
  const [days, setDays] = useState<DayAvailability[]>([]);
  const [loading, setLoading] = useState(false);
  const [busyDate, setBusyDate] = useState<string | null>(null);

  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function refetch() {
    if (!roomId) return Promise.resolve();
    return fetch(`/api/availability/${roomId}?month=${monthParam(monthDate)}`)
      .then((res) => res.json())
      .then((data) => setDays(data.days ?? []));
  }

  useEffect(() => {
    if (!roomId) return;
    setLoading(true);
    refetch().finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId, monthDate]);

  async function toggleDay(day: DayAvailability) {
    if (day.source === "booking") return; // booking-derived, not manually editable
    setBusyDate(day.date);
    await fetch(`/api/availability/${roomId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ from: day.date, to: day.date, isBlocked: !day.isBlocked }),
    });
    await refetch();
    setBusyDate(null);
  }

  async function handleRangeAction(isBlocked: boolean) {
    setSaving(true);
    setError(null);

    const res = await fetch(`/api/availability/${roomId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ from, to, isBlocked }),
    });

    setSaving(false);

    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setError(data?.error ? JSON.stringify(data.error) : "Could not update availability.");
      return;
    }
    await refetch();
  }

  const daysInMonth = new Date(Date.UTC(monthDate.getUTCFullYear(), monthDate.getUTCMonth() + 1, 0)).getUTCDate();
  const firstWeekday = monthDate.getUTCDay();

  const cells: CalendarCell[] = days.map((d) => {
    let className = "bg-sea/10 text-cream/70"; // available
    let label = "Open";
    if (d.source === "booking") {
      className = "bg-coraldeep/40 text-cream/60 cursor-not-allowed";
      label = "Booked";
    } else if (d.isBlocked) {
      className = "bg-coral/20 text-coral";
      label = "Blocked";
    }
    return {
      date: d.date,
      content: <span className="text-[0.6rem]">{label}</span>,
      className: busyDate === d.date ? `${className} opacity-50` : className,
      onClick: d.source === "booking" ? undefined : () => toggleDay(d),
    };
  });

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
        <p className="mt-3 text-xs text-cream/40">
          Click a day to toggle a manual block. Dates covered by a booking are blocked automatically and can&rsquo;t be
          toggled here.
        </p>
      </div>

      <div>
        <h2 className="font-display italic text-lg mb-4">Block a range</h2>
        <div className="space-y-4 bg-ink2/40 border border-cream/10 rounded-xl p-5">
          <div>
            <label className="eyebrow text-cream/60 block mb-1">From</label>
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="w-full bg-transparent border-b border-cream/25 py-2 text-cream text-sm focus:outline-none focus:border-coral"
            />
          </div>
          <div>
            <label className="eyebrow text-cream/60 block mb-1">To</label>
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="w-full bg-transparent border-b border-cream/25 py-2 text-cream text-sm focus:outline-none focus:border-coral"
            />
          </div>

          {error && <p className="text-sm text-coral">{error}</p>}

          <div className="flex gap-3">
            <button
              type="button"
              disabled={saving || !from || !to}
              onClick={() => handleRangeAction(true)}
              className="flex-1 rounded-full bg-coral hover:bg-coraldeep transition-colors py-2.5 text-sm font-medium disabled:opacity-60"
            >
              Block
            </button>
            <button
              type="button"
              disabled={saving || !from || !to}
              onClick={() => handleRangeAction(false)}
              className="flex-1 rounded-full border border-cream/25 hover:border-cream/50 transition-colors py-2.5 text-sm font-medium disabled:opacity-60"
            >
              Unblock
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
