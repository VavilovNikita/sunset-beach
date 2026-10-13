"use client";

import { useState } from "react";
import { saveGymHallSettings } from "@/lib/gymScheduleClient";
import { hallSettingsProblem } from "@/lib/gymSchedule";
import { AC_MODES, AC_TEMP_MAX, AC_TEMP_MIN, AC_WINDS } from "@/lib/gym";
import type { GymHallSettings } from "@/lib/types";

const FIELD = "w-full min-h-[44px] bg-ink border border-cream/20 rounded-lg px-3 text-sm";

// ADMIN: the gym's opening hours (the grid's rows of slots) and what the reservation automation
// does - how long before a session the equipment goes on, and the one scene command sent to the air
// conditioners at switch-on. Which devices take part is set per device in the list below.
export default function GymHallSettingsForm({ initial }: { initial: GymHallSettings }) {
  const [saved, setSaved] = useState(initial);
  const [values, setValues] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const dirty = JSON.stringify(saved) !== JSON.stringify(values);
  const problem = hallSettingsProblem(values);

  function number(field: keyof GymHallSettings) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      setNotice(null);
      setValues({ ...values, [field]: e.target.value === "" ? Number.NaN : Number(e.target.value) });
    };
  }
  function text(field: "openTime" | "closeTime") {
    return (e: React.ChangeEvent<HTMLInputElement>) => {
      setNotice(null);
      setValues({ ...values, [field]: e.target.value });
    };
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (problem) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    const result = await saveGymHallSettings(values);
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setSaved(result.data);
    setValues(result.data);
    setNotice("Saved.");
  }

  return (
    <form onSubmit={submit} className="bg-ink2/40 border border-cream/10 rounded-xl p-4 mb-8 space-y-4">
      <div>
        <h2 className="eyebrow text-cream/60 mb-1">Gym reservations</h2>
        <p className="text-xs text-cream/50">
          Guests book in 30-minute steps for 30 to 120 minutes, at most 120 minutes a day per booking. The hours apply to new reservations;
          existing ones are not touched.
        </p>
      </div>

      <div className="grid sm:grid-cols-3 gap-3">
        <div>
          <label htmlFor="hall-open" className="text-xs text-cream/60 block mb-1">
            Opens
          </label>
          <input id="hall-open" type="time" step={1800} value={values.openTime} onChange={text("openTime")} className={FIELD} />
        </div>
        <div>
          <label htmlFor="hall-close" className="text-xs text-cream/60 block mb-1">
            Closes
          </label>
          <input id="hall-close" type="time" step={1800} value={values.closeTime} onChange={text("closeTime")} className={FIELD} />
        </div>
        <div>
          <label htmlFor="hall-lead" className="text-xs text-cream/60 block mb-1">
            Switch on this many minutes before
          </label>
          <input
            id="hall-lead"
            type="number"
            min={0}
            max={180}
            value={Number.isNaN(values.leadMinutes) ? "" : values.leadMinutes}
            onChange={number("leadMinutes")}
            className={FIELD}
          />
        </div>
      </div>
      <p className="text-xs text-cream/50 -mt-2">
        The same time is the gap between two sessions below which the equipment is not switched off in between.
      </p>

      <div>
        <p className="text-xs text-cream/60 mb-1">Air conditioners at switch-on (one command)</p>
        <div className="grid sm:grid-cols-3 gap-3">
          <div>
            <label htmlFor="hall-mode" className="text-xs text-cream/50 block mb-1">
              Mode
            </label>
            <select id="hall-mode" value={values.acMode} onChange={number("acMode")} className={FIELD}>
              {AC_MODES.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="hall-temp" className="text-xs text-cream/50 block mb-1">
              Temperature, °C
            </label>
            <input
              id="hall-temp"
              type="number"
              min={AC_TEMP_MIN}
              max={AC_TEMP_MAX}
              value={Number.isNaN(values.acTemp) ? "" : values.acTemp}
              onChange={number("acTemp")}
              className={FIELD}
            />
          </div>
          <div>
            <label htmlFor="hall-wind" className="text-xs text-cream/50 block mb-1">
              Fan speed
            </label>
            <select id="hall-wind" value={values.acWind} onChange={number("acWind")} className={FIELD}>
              {AC_WINDS.map((w) => (
                <option key={w.value} value={w.value}>
                  {w.label}
                  {w.value === 3 ? " (strongest)" : ""}
                </option>
              ))}
            </select>
          </div>
        </div>
        <p className="text-xs text-cream/50 mt-2">At the end the same command is sent with power off. Fans are plain on/off relays.</p>
      </div>

      {dirty && problem && <p className="text-sm text-amber-400">{problem}</p>}
      {error && <p className="text-sm text-coral">{error}</p>}
      {notice && <p className="text-sm text-sea">{notice}</p>}
      <button
        type="submit"
        disabled={busy || !dirty || problem !== null}
        className="min-h-[44px] rounded-full bg-coral hover:bg-coraldeep transition-colors px-6 text-sm font-medium disabled:opacity-60"
      >
        {busy ? "Saving…" : "Save"}
      </button>
    </form>
  );
}
