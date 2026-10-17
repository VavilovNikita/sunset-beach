"use client";

import { useState } from "react";
import { saveNotificationSettings } from "@/lib/notificationClient";
import {
  NOTIFICATION_LANGUAGES,
  settingsFormDirty,
  settingsServerError,
  toSettingsForm,
  toggleId,
  validateSettingsForm,
  type SettingsFieldErrors,
  type SettingsForm,
} from "@/lib/notifications";
import type { NotificationLanguage, NotificationSettings, NotificationStaffMember } from "@/lib/types";

const INPUT = "bg-ink border border-cream/20 rounded-lg px-3 py-2 min-h-[44px] text-sm";
const PRIMARY = "min-h-[44px] rounded-full bg-coral hover:bg-coraldeep transition-colors px-5 text-sm font-medium disabled:opacity-60";

function FieldError({ message }: { message?: string }) {
  return message ? <p className="text-xs text-coral mt-1">{message}</p> : null;
}

// ADMIN. One card per kind of alert, then quiet hours and language, then who is told. Saved as a
// whole (PUT replaces every field); what the page shows afterwards is what the server answered.
export default function NotificationSettingsForm({ initial, staff }: { initial: NotificationSettings; staff: NotificationStaffMember[] }) {
  const [saved, setSaved] = useState(initial);
  const [form, setForm] = useState<SettingsForm>(() => toSettingsForm(initial));
  const [errors, setErrors] = useState<SettingsFieldErrors>({});
  const [saving, setSaving] = useState(false);
  const [savedNote, setSavedNote] = useState<string | null>(null);

  const dirty = settingsFormDirty(form, saved);
  const activeStaff = staff.filter((m) => m.isActive);

  function set<K extends keyof SettingsForm>(key: K, value: SettingsForm[K]) {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => ({ ...e, [key]: undefined, form: undefined }));
    setSavedNote(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSavedNote(null);
    const checked = validateSettingsForm(form, saved.minLateGraceMinutes);
    if (!checked.ok) {
      setErrors(checked.errors);
      return;
    }
    setErrors({});
    setSaving(true);
    const result = await saveNotificationSettings(checked.input);
    setSaving(false);
    if (!result.ok) {
      const { field, message } = settingsServerError(result.status, result.error, result.body);
      setErrors({ [field]: message });
      return;
    }
    setSaved(result.data);
    setForm(toSettingsForm(result.data));
    setSavedNote("Saved.");
  }

  const number = (key: "lateGraceMinutes" | "absenceMinutes" | "terminalSilenceMinutes", label: string, hint?: string) => (
    <div>
      <label className="flex items-center gap-3 text-sm text-cream">
        <input
          value={form[key]}
          onChange={(e) => set(key, e.target.value)}
          inputMode="numeric"
          aria-invalid={errors[key] ? true : undefined}
          className={`${INPUT} w-24`}
        />
        {label}
      </label>
      {hint && !errors[key] && <p className="text-xs text-cream/40 mt-1">{hint}</p>}
      <FieldError message={errors[key]} />
    </div>
  );

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Card
        title="Late"
        description="The employee and the people chosen below are told that a shift interval has started and nobody has clocked in."
        enabled={form.lateEnabled}
        onToggle={(v) => set("lateEnabled", v)}
      >
        {number("lateGraceMinutes", "minutes after the planned start", `At least ${saved.minLateGraceMinutes} minutes - the attendance terminal is read every ${saved.minLateGraceMinutes} minutes.`)}
        <RecipientPicker
          label="Also tell"
          staff={activeStaff}
          selected={form.lateRecipientUserIds}
          onToggle={(id) => set("lateRecipientUserIds", toggleId(form.lateRecipientUserIds, id))}
          error={errors.lateRecipientUserIds}
        />
      </Card>

      <Card
        title="Absent"
        description="The directors are told that an employee still has not clocked in."
        enabled={form.absenceEnabled}
        onToggle={(v) => set("absenceEnabled", v)}
      >
        {number("absenceMinutes", "minutes after the planned start")}
      </Card>

      <Card
        title="Attendance terminal not responding"
        description="While a terminal has not answered, nobody can be told they are late (its punches are unknown), so the late and absent messages pause and the directors are told once. They are told once more when it is back."
        enabled={form.terminalAlertsEnabled}
        onToggle={(v) => set("terminalAlertsEnabled", v)}
      >
        {number("terminalSilenceMinutes", "minutes without an answer", "The pause itself does not depend on this switch.")}
      </Card>

      <Card
        title="Room blocks"
        description="Whoever is on shift now with the block's function (engineer or housekeeper) is told; if nobody is, the directors are."
      >
        <label className="flex items-center gap-2 text-sm text-cream">
          <input type="checkbox" checked={form.blockCreatedEnabled} onChange={(e) => set("blockCreatedEnabled", e.target.checked)} className="accent-coral" />
          When a block is created
        </label>
        <label className="flex items-center gap-2 text-sm text-cream">
          <input type="checkbox" checked={form.blockLastDayEnabled} onChange={(e) => set("blockLastDayEnabled", e.target.checked)} className="accent-coral" />
          On the morning of its last day
        </label>
        <label className="flex items-center gap-2 text-sm text-cream">
          <input type="checkbox" checked={form.blockExpiredEnabled} onChange={(e) => set("blockExpiredEnabled", e.target.checked)} className="accent-coral" />
          Every morning after it ended while its maintenance task is not done
        </label>
        <div>
          <label className="flex items-center gap-3 text-sm text-cream">
            <input
              type="time"
              value={form.morningTime}
              onChange={(e) => set("morningTime", e.target.value)}
              aria-invalid={errors.morningTime ? true : undefined}
              className={INPUT}
            />
            morning reminders at (hotel time)
          </label>
          <FieldError message={errors.morningTime} />
        </div>
      </Card>

      <div className="bg-ink2/40 border border-cream/10 rounded-xl p-5 space-y-3">
        <label className="flex items-center gap-2 text-sm text-cream font-medium">
          <input type="checkbox" checked={form.quietHoursEnabled} onChange={(e) => set("quietHoursEnabled", e.target.checked)} className="accent-coral" />
          Quiet hours
        </label>
        <p className="text-xs text-cream/50">
          A message that comes up during quiet hours waits and is sent when they end - each one on its own, never combined. Hotel time (Asia/Bangkok).
        </p>
        <div className="flex flex-wrap items-start gap-4">
          <div>
            <label className="eyebrow text-cream/60 block mb-1">From</label>
            <input
              type="time"
              value={form.quietStart}
              disabled={!form.quietHoursEnabled}
              onChange={(e) => set("quietStart", e.target.value)}
              aria-invalid={errors.quietStart ? true : undefined}
              className={`${INPUT} disabled:opacity-50`}
            />
            <FieldError message={errors.quietStart} />
          </div>
          <div>
            <label className="eyebrow text-cream/60 block mb-1">Until</label>
            <input
              type="time"
              value={form.quietEnd}
              disabled={!form.quietHoursEnabled}
              onChange={(e) => set("quietEnd", e.target.value)}
              aria-invalid={errors.quietEnd ? true : undefined}
              className={`${INPUT} disabled:opacity-50`}
            />
            <FieldError message={errors.quietEnd} />
          </div>
        </div>
      </div>

      <div className="bg-ink2/40 border border-cream/10 rounded-xl p-5 space-y-3">
        <p className="text-sm text-cream font-medium">Directors</p>
        <RecipientPicker
          label="Who is told about absences, a silent terminal and blocks nobody on shift can take"
          staff={activeStaff}
          selected={form.directorUserIds}
          onToggle={(id) => set("directorUserIds", toggleId(form.directorUserIds, id))}
          error={errors.directorUserIds}
        />
      </div>

      <div className="bg-ink2/40 border border-cream/10 rounded-xl p-5 space-y-2">
        <label className="eyebrow text-cream/60 block" htmlFor="default-language">
          Default language
        </label>
        <select
          id="default-language"
          value={form.defaultLanguage}
          onChange={(e) => set("defaultLanguage", e.target.value as NotificationLanguage)}
          className={INPUT}
        >
          {NOTIFICATION_LANGUAGES.map((l) => (
            <option key={l.value} value={l.value}>
              {l.label}
            </option>
          ))}
        </select>
        <p className="text-xs text-cream/40">For anyone without a language of their own (set per employee on the Notification channels page).</p>
      </div>

      {errors.form && <p className="text-sm text-coral">{errors.form}</p>}
      <div className="flex items-center gap-3">
        <button type="submit" disabled={saving || !dirty} className={PRIMARY}>
          {saving ? "Saving…" : "Save"}
        </button>
        {savedNote && !dirty && <span className="text-sm text-cream/60">{savedNote}</span>}
      </div>
    </form>
  );
}

function Card({
  title,
  description,
  enabled,
  onToggle,
  children,
}: {
  title: string;
  description: string;
  // Both absent: a card with no master switch of its own (its parts have theirs).
  enabled?: boolean;
  onToggle?: (value: boolean) => void;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-ink2/40 border border-cream/10 rounded-xl p-5 space-y-3">
      {onToggle ? (
        <label className="flex items-center gap-2 text-sm text-cream font-medium">
          <input type="checkbox" checked={enabled === true} onChange={(e) => onToggle(e.target.checked)} className="accent-coral" />
          {title}
        </label>
      ) : (
        <p className="text-sm text-cream font-medium">{title}</p>
      )}
      <p className="text-xs text-cream/50">{description}</p>
      <div className={enabled === false ? "space-y-3 opacity-50" : "space-y-3"}>{children}</div>
    </div>
  );
}

// A checkbox list of active staff. Long enough in a real hotel to scroll, short enough to read.
function RecipientPicker({
  label,
  staff,
  selected,
  onToggle,
  error,
}: {
  label: string;
  staff: NotificationStaffMember[];
  selected: string[];
  onToggle: (userId: string) => void;
  error?: string;
}) {
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const shown = staff.filter((m) => !q || m.name.toLowerCase().includes(q) || selected.includes(m.userId));
  return (
    <fieldset>
      <legend className="eyebrow text-cream/60 mb-1">
        {label} <span className="text-cream/40">({selected.length} chosen)</span>
      </legend>
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Find by name"
        aria-label="Find by name"
        className={`${INPUT} w-full max-w-xs mb-2 placeholder:text-cream/30`}
      />
      <div className="max-h-48 overflow-y-auto rounded-lg border border-cream/10 divide-y divide-cream/10">
        {shown.length === 0 && <p className="px-3 py-2 text-sm text-cream/50">Nobody matches.</p>}
        {shown.map((m) => (
          <label key={m.userId} className="flex items-center gap-2 px-3 min-h-[44px] text-sm text-cream cursor-pointer">
            <input type="checkbox" checked={selected.includes(m.userId)} onChange={() => onToggle(m.userId)} className="accent-coral" />
            <span>{m.name}</span>
            {!m.telegramLinked && <span className="text-xs text-cream/40">no Telegram chat</span>}
          </label>
        ))}
      </div>
      <FieldError message={error} />
    </fieldset>
  );
}
