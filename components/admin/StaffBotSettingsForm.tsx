"use client";

import { useState } from "react";
import HrVacationForm from "@/components/admin/HrVacationForm";
import { saveStaffBotSettings } from "@/lib/shiftRequestClient";
import {
  BOT_GROUPS,
  BOT_NUMBER_FIELDS,
  BOT_TIME_FIELDS,
  botSettingsFormDirty,
  botSettingsServerError,
  directorsTelegramSummary,
  toBotSettingsForm,
  validateBotSettingsForm,
  type BotNumberKey,
  type BotSettingsFieldErrors,
  type BotSettingsForm,
  type BotTimeKey,
  type BotToggleKey,
} from "@/lib/staffBotSettings";
import { decidersSummary } from "@/lib/shiftRequests";
import type { NotificationStaffMember, ShiftRequestDeciders, StaffBotSettings } from "@/lib/types";

const INPUT = "bg-ink border border-cream/20 rounded-lg px-3 py-2 min-h-[44px] text-sm";
const PRIMARY = "min-h-[44px] rounded-full bg-coral hover:bg-coraldeep transition-colors px-5 text-sm font-medium disabled:opacity-60";
const CARD = "bg-ink2/40 border border-cream/10 rounded-xl p-5 space-y-3";

function FieldError({ message }: { message?: string }) {
  return message ? <p className="text-xs text-coral mt-1">{message}</p> : null;
}

// ADMIN. What the staff Telegram bot offers and how shift requests behave: every screen, threshold, time and switch is here,
// none is fixed in code, grouped by who the screen is for. Saved as a whole (PUT replaces every field); what the page
// shows afterwards is what the server answered. The HR director's leave is edited here too (and by the HR director on
// the requests page). `directorUserIds` and `staff` are the alert settings as saved: the morning summary goes to those
// directors, and the note beside its switch says how many of them can actually receive it.
export default function StaffBotSettingsForm({
  initial,
  deciders: initialDeciders,
  directorUserIds,
  staff,
}: {
  initial: StaffBotSettings;
  deciders: ShiftRequestDeciders;
  directorUserIds: string[];
  staff: NotificationStaffMember[];
}) {
  const [saved, setSaved] = useState(initial);
  const [form, setForm] = useState<BotSettingsForm>(() => toBotSettingsForm(initial));
  const [errors, setErrors] = useState<BotSettingsFieldErrors>({});
  const [saving, setSaving] = useState(false);
  const [savedNote, setSavedNote] = useState<string | null>(null);
  const [deciders, setDeciders] = useState(initialDeciders);

  const dirty = botSettingsFormDirty(form, saved);
  const directors = directorsTelegramSummary(directorUserIds, staff);

  function set<K extends keyof BotSettingsForm>(key: K, value: BotSettingsForm[K]) {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => ({ ...e, [key]: undefined, form: undefined }));
    setSavedNote(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSavedNote(null);
    const checked = validateBotSettingsForm(form);
    if (!checked.ok) {
      setErrors(checked.errors);
      return;
    }
    setErrors({});
    setSaving(true);
    const result = await saveStaffBotSettings(checked.input);
    setSaving(false);
    if (!result.ok) {
      const { field, message } = botSettingsServerError(result.status, result.error, result.body);
      setErrors({ [field]: message });
      return;
    }
    setSaved(result.data);
    setForm(toBotSettingsForm(result.data));
    setSavedNote("Saved.");
  }

  const toggle = (key: BotToggleKey, label: string, hint?: string) => (
    <div key={key}>
      <label className="flex items-center gap-2 text-sm text-cream">
        <input type="checkbox" checked={form[key]} onChange={(e) => set(key, e.target.checked)} className="accent-coral" />
        {label}
      </label>
      {hint && <p className="text-xs text-cream/40 ml-6">{hint}</p>}
      {key === "morningSummaryEnabled" && (
        <p className={`text-xs ml-6 mt-1 ${directors.selected === 0 || directors.linked === 0 ? "text-amber-400" : "text-cream/60"}`}>{directors.text}</p>
      )}
    </div>
  );

  const number = (key: BotNumberKey) => {
    const f = BOT_NUMBER_FIELDS.find((n) => n.key === key)!;
    return (
      <div key={key}>
        <label className="flex flex-wrap items-center gap-3 text-sm text-cream">
          <input
            value={form[key]}
            onChange={(e) => set(key, e.target.value)}
            inputMode="numeric"
            aria-invalid={errors[key] ? true : undefined}
            className={`${INPUT} w-24`}
          />
          {f.label} ({f.unit})
        </label>
        {!errors[key] && <p className="text-xs text-cream/40 mt-1">{f.hint}</p>}
        <FieldError message={errors[key]} />
      </div>
    );
  };

  const time = (key: BotTimeKey) => {
    const f = BOT_TIME_FIELDS.find((n) => n.key === key)!;
    return (
      <div key={key}>
        <label className="flex items-center gap-3 text-sm text-cream">
          <input
            type="time"
            value={form[key]}
            onChange={(e) => set(key, e.target.value)}
            aria-invalid={errors[key] ? true : undefined}
            className={INPUT}
          />
          {f.label}
        </label>
        <FieldError message={errors[key]} />
      </div>
    );
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {BOT_GROUPS.map((group) => (
        <div key={group.id} className={CARD}>
          <p className="text-sm text-cream font-medium">{group.title}</p>
          {group.id === "requests" ? (
            <p className="text-xs text-cream/50">
              An employee can ask to move a shift to a free day or to take it off; the HR director decides in the bot or on the Shift requests page.
              Approving changes the roster. {decidersSummary(deciders)}
            </p>
          ) : (
            group.note && <p className="text-xs text-cream/50">{group.note}</p>
          )}
          {group.toggles.map((t) => toggle(t.key, t.label, t.hint))}
          {group.numbers.map((key) => number(key))}
          {group.times.map((key) => time(key))}
          {group.id === "requests" && (
            <div className="pt-2 border-t border-cream/10">
              <HrVacationForm deciders={deciders} onSaved={setDeciders} />
            </div>
          )}
        </div>
      ))}

      {errors.form && <p className="text-sm text-coral">{errors.form}</p>}
      <div className="flex items-center gap-4">
        <button type="submit" disabled={saving || !dirty} className={PRIMARY}>
          {saving ? "Saving…" : "Save bot settings"}
        </button>
        {savedNote && !dirty && <span className="text-sm text-green-600">{savedNote}</span>}
      </div>
    </form>
  );
}
