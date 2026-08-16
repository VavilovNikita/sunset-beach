"use client";

import { useEffect, useState } from "react";
import PriceCalendar, { type CalendarCell } from "@/components/admin/PriceCalendar";
import { ADMIN_API_URL } from "@/lib/backend";
import type { AvailabilityDay } from "@/lib/types";

type Room = { id: string; name: string };

const MONTH_FORMAT = new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric", timeZone: "UTC" });

function monthParam(monthDate: Date) {
  return `${monthDate.getUTCFullYear()}-${String(monthDate.getUTCMonth() + 1).padStart(2, "0")}`;
}

// The backend reports validation failures two different ways: a plain
// `{ error: "..." }` string, or `{ error: { formErrors, fieldErrors } }`
// (Zod's error.flatten()). Collapse both into one readable line instead of
// dumping raw JSON at the manager.
function formatApiError(data: unknown, fallback: string): string {
  if (!data || typeof data !== "object" || !("error" in data)) return fallback;
  const err = (data as { error: unknown }).error;
  if (typeof err === "string") return err;
  if (err && typeof err === "object") {
    const { formErrors, fieldErrors } = err as { formErrors?: string[]; fieldErrors?: Record<string, string[]> };
    const messages = [
      ...(formErrors ?? []),
      ...Object.values(fieldErrors ?? {}).flat(),
    ];
    if (messages.length > 0) return messages.join(" ");
  }
  return fallback;
}

export default function AvailabilityManager({ rooms }: { rooms: Room[] }) {
  const [roomId, setRoomId] = useState(rooms[0]?.id ?? "");
  const [monthDate, setMonthDate] = useState(() => {
    const now = new Date();
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  });
  const [days, setDays] = useState<AvailabilityDay[]>([]);
  const [loading, setLoading] = useState(false);

  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [blockedCount, setBlockedCount] = useState("0");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Room.quantity is echoed on every day row; any loaded day tells us the
  // current cap for this room's manual blocks.
  const roomQuantity = days[0]?.quantity ?? null;
  const blockedCountNum = Number(blockedCount);
  const exceedsQuantity =
    roomQuantity !== null && Number.isFinite(blockedCountNum) && blockedCountNum > roomQuantity;

  function refetch() {
    if (!roomId) return Promise.resolve();
    return fetch(`${ADMIN_API_URL}/availability/${roomId}?month=${monthParam(monthDate)}`, {
      credentials: "include",
    })
      .then((res) => res.json())
      .then((data) => setDays(data.days ?? []));
  }

  useEffect(() => {
    if (!roomId) return;
    setLoading(true);
    refetch().finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId, monthDate]);

  function selectDay(day: AvailabilityDay) {
    setFrom(day.date);
    setTo(day.date);
    setBlockedCount(String(day.blockedCount));
    setError(null);
  }

  async function handleApply() {
    if (!Number.isFinite(blockedCountNum) || blockedCountNum < 0 || exceedsQuantity) return;

    setSaving(true);
    setError(null);

    const res = await fetch(`${ADMIN_API_URL}/availability/${roomId}`, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ from, to, blockedCount: blockedCountNum }),
    });

    setSaving(false);

    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setError(formatApiError(data, "Could not update availability."));
      return;
    }
    await refetch();
  }

  const daysInMonth = new Date(Date.UTC(monthDate.getUTCFullYear(), monthDate.getUTCMonth() + 1, 0)).getUTCDate();
  const firstWeekday = monthDate.getUTCDay();

  const cells: CalendarCell[] = days.map((d) => {
    let className = "bg-sea/10 text-cream/70"; // fully open
    if (d.availableCount <= 0) {
      className = "bg-coraldeep/40 text-cream/70"; // sold out / fully blocked
    } else if (d.blockedCount > 0 || d.bookedCount > 0) {
      className = "bg-coral/15 text-cream/80"; // partially reduced
    }
    return {
      date: d.date,
      content: (
        <div className="flex flex-col items-center leading-tight">
          <span className="text-[0.65rem] font-medium">
            {d.availableCount}/{d.quantity}
          </span>
          {(d.bookedCount > 0 || d.blockedCount > 0) && (
            <span className="text-[0.5rem] text-cream/50">
              {d.bookedCount > 0 && `${d.bookedCount} booked`}
              {d.bookedCount > 0 && d.blockedCount > 0 && " · "}
              {d.blockedCount > 0 && `${d.blockedCount} blocked`}
            </span>
          )}
        </div>
      ),
      className: from === d.date && to === d.date ? `${className} ring-2 ring-coral` : className,
      onClick: () => selectDay(d),
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
          Each day shows remaining/total units. Click a day to load it into the panel on the right, where you can set
          how many units to withdraw from sale. &ldquo;Booked&rdquo; comes from real reservations and can&rsquo;t be
          edited here; &ldquo;blocked&rdquo; is the manual withdrawal you control.
        </p>
      </div>

      <div>
        <h2 className="font-display italic text-lg mb-4">Set manual block</h2>
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
          <div>
            <label className="eyebrow text-cream/60 block mb-1">
              Units to withdraw from sale{roomQuantity !== null ? ` (max ${roomQuantity})` : ""}
            </label>
            <input
              type="number"
              min={0}
              max={roomQuantity ?? undefined}
              value={blockedCount}
              onChange={(e) => setBlockedCount(e.target.value)}
              className="w-full bg-transparent border-b border-cream/25 py-2 text-cream text-sm focus:outline-none focus:border-coral"
            />
            <p className="mt-1 text-xs text-cream/40">0 removes any existing manual block for these dates.</p>
            {exceedsQuantity && (
              <p className="mt-1 text-xs text-coral">
                This room type only has {roomQuantity} unit{roomQuantity === 1 ? "" : "s"}.
              </p>
            )}
          </div>

          {error && <p className="text-sm text-coral">{error}</p>}

          <button
            type="button"
            disabled={saving || !from || !to || !Number.isFinite(blockedCountNum) || blockedCountNum < 0 || exceedsQuantity}
            onClick={handleApply}
            className="w-full rounded-full bg-coral hover:bg-coraldeep transition-colors py-2.5 text-sm font-medium disabled:opacity-60"
          >
            {saving ? "Saving…" : "Apply"}
          </button>
        </div>
      </div>
    </div>
  );
}
