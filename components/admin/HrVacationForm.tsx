"use client";

import { useState } from "react";
import { saveHrVacation } from "@/lib/shiftRequestClient";
import { vacationChanged, vacationFormError, vacationInput } from "@/lib/shiftRequests";
import type { ShiftRequestDeciders } from "@/lib/types";

const INPUT = "bg-ink border border-cream/20 rounded-lg px-3 py-2 min-h-[44px] text-sm";

// The HR director's leave (hotel dates, both days included). While it lasts, requests go to the administrators if
// the settings let them cover. The HR holder sets their own; an administrator sets it for them. Used on the
// requests page and on the bot settings page. Save is enabled only for a real change; a rejection is shown here.
export default function HrVacationForm({
  deciders,
  onSaved,
}: {
  deciders: ShiftRequestDeciders;
  onSaved: (next: ShiftRequestDeciders) => void;
}) {
  const [from, setFrom] = useState(deciders.vacationFrom ?? "");
  const [to, setTo] = useState(deciders.vacationTo ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  if (!deciders.hrUserId) {
    return <p className="text-sm text-cream/60">Nobody holds the HR function, so there is no leave to set.</p>;
  }

  const problem = vacationFormError(from, to);
  const changed = vacationChanged(from, to, deciders);

  async function save(nextFrom: string, nextTo: string) {
    setBusy(true);
    setError(null);
    setNote(null);
    const result = await saveHrVacation(vacationInput(nextFrom, nextTo));
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setFrom(result.data.vacationFrom ?? "");
    setTo(result.data.vacationTo ?? "");
    setNote(result.data.vacationFrom ? "Leave saved." : "Leave cleared.");
    onSaved(result.data);
  }

  return (
    <div>
      <p className="eyebrow text-cream/60 mb-2">{deciders.hrName ? `Leave of ${deciders.hrName}` : "Leave"}</p>
      <div className="flex flex-wrap items-end gap-3">
        <label className="text-sm">
          <span className="block text-cream/60 mb-1">First day</span>
          <input type="date" value={from} onChange={(e) => { setFrom(e.target.value); setNote(null); }} className={INPUT} />
        </label>
        <label className="text-sm">
          <span className="block text-cream/60 mb-1">Last day</span>
          <input type="date" value={to} onChange={(e) => { setTo(e.target.value); setNote(null); }} className={INPUT} />
        </label>
        <button
          type="button"
          disabled={busy || !changed || problem !== null}
          onClick={() => save(from, to)}
          className="min-h-[44px] rounded-full bg-coral hover:bg-coraldeep transition-colors px-5 text-sm font-medium disabled:opacity-60"
        >
          {busy ? "Saving…" : "Save leave"}
        </button>
        {(deciders.vacationFrom || deciders.vacationTo) && (
          <button
            type="button"
            disabled={busy}
            onClick={() => save("", "")}
            className="min-h-[44px] px-2 text-sm text-cream/60 hover:text-cream transition-colors disabled:opacity-60"
          >
            Clear
          </button>
        )}
      </div>
      {changed && problem && <p className="text-xs text-coral mt-1">{problem}</p>}
      {error && <p className="text-sm text-coral mt-2">{error}</p>}
      {note && <p className="text-sm text-green-600 mt-2">{note}</p>}
    </div>
  );
}
