"use client";

import RecipientPicker from "@/components/admin/notificationSettings/RecipientPicker";
import SettingsCard, { FieldError, INPUT } from "@/components/admin/notificationSettings/SettingsCard";
import { CheckField, NumberField, TimeField } from "@/components/admin/notificationSettings/fields";
import SettingsTabLink from "@/components/admin/notificationSettings/SettingsTabLink";
import { NOTIFICATION_LANGUAGES, toggleId, type SettingsFieldErrors, type SettingsForm } from "@/lib/notifications";
import type { NotificationLanguage, NotificationStaffMember } from "@/lib/types";

export type AlertPanelProps = {
  form: SettingsForm;
  set: <K extends keyof SettingsForm>(key: K, value: SettingsForm[K]) => void;
  errors: SettingsFieldErrors;
  staff: NotificationStaffMember[]; // active only
  minLateGraceMinutes: number;
};

const has = (errors: SettingsFieldErrors, ...keys: (keyof SettingsForm)[]) => keys.some((k) => Boolean(errors[k]));

// The tabs that are the alert settings (PUT /settings/notifications). Same fields, same labels as before; only the
// arrangement is new.
export function AttendanceAlertsPanel({ form, set, errors, minLateGraceMinutes }: AlertPanelProps) {
  return (
    <div className="grid gap-4 lg:grid-cols-2 items-start">
      <SettingsCard
        title="Late"
        short="Told when a shift interval has started and nobody has clocked in."
        more={
          <p>
            The employee and the people chosen under “Also tell” on{" "}
            <SettingsTabLink tab="recipients" className="underline">
              Recipients &amp; delivery
            </SettingsTabLink>{" "}
            are told that a shift interval has started and nobody has clocked in.
          </p>
        }
        enabled={form.lateEnabled}
        onToggle={(v) => set("lateEnabled", v)}
        hasError={has(errors, "lateGraceMinutes")}
      >
        <NumberField
          label="minutes after the planned start"
          value={form.lateGraceMinutes}
          onChange={(v) => set("lateGraceMinutes", v)}
          error={errors.lateGraceMinutes}
          hint={`At least ${minLateGraceMinutes} minutes - the attendance terminal is read every ${minLateGraceMinutes} minutes.`}
        />
      </SettingsCard>

      <SettingsCard
        title="Absent"
        short="The directors are told that an employee still has not clocked in."
        enabled={form.absenceEnabled}
        onToggle={(v) => set("absenceEnabled", v)}
        hasError={has(errors, "absenceMinutes")}
      >
        <NumberField label="minutes after the planned start" value={form.absenceMinutes} onChange={(v) => set("absenceMinutes", v)} error={errors.absenceMinutes} />
      </SettingsCard>

      <SettingsCard
        title="Attendance terminal not responding"
        short="The directors are told once when a terminal goes silent, and once when it is back."
        more={
          <p>
            While a terminal has not answered, nobody can be told they are late (its punches are unknown), so the late and absent messages pause and the
            directors are told once. They are told once more when it is back.
          </p>
        }
        enabled={form.terminalAlertsEnabled}
        onToggle={(v) => set("terminalAlertsEnabled", v)}
        hasError={has(errors, "terminalSilenceMinutes")}
      >
        <NumberField
          label="minutes without an answer"
          value={form.terminalSilenceMinutes}
          onChange={(v) => set("terminalSilenceMinutes", v)}
          error={errors.terminalSilenceMinutes}
          hint="The pause itself does not depend on this switch."
        />
      </SettingsCard>
    </div>
  );
}

export function RoomBlocksPanel({ form, set, errors }: AlertPanelProps) {
  return (
    <div className="grid gap-4 lg:grid-cols-2 items-start">
      <SettingsCard
        title="Room blocks"
        short="Whoever is on shift with the block's function is told; if nobody is, the directors."
        more={<p>Whoever is on shift now with the block&rsquo;s function (engineer or housekeeper) is told; if nobody is, the directors are.</p>}
      >
        <CheckField label="When a block is created" checked={form.blockCreatedEnabled} onChange={(v) => set("blockCreatedEnabled", v)} />
        <CheckField label="On the morning of its last day" checked={form.blockLastDayEnabled} onChange={(v) => set("blockLastDayEnabled", v)} />
        <CheckField
          label="Every morning after it ended while its maintenance task is not done"
          checked={form.blockExpiredEnabled}
          onChange={(v) => set("blockExpiredEnabled", v)}
        />
        <TimeField label="morning reminders at (hotel time)" value={form.morningTime} onChange={(v) => set("morningTime", v)} error={errors.morningTime} />
      </SettingsCard>
    </div>
  );
}

export function RecipientsPanel({ form, set, errors, staff }: AlertPanelProps) {
  return (
    <div className="grid gap-4 lg:grid-cols-2 items-start">
      <SettingsCard title="Directors" short="Told about absences, a silent terminal and blocks nobody on shift can take.">
        <RecipientPicker
          label="Who is told about absences, a silent terminal and blocks nobody on shift can take"
          staff={staff}
          selected={form.directorUserIds}
          onToggle={(id) => set("directorUserIds", toggleId(form.directorUserIds, id))}
          error={errors.directorUserIds}
        />
      </SettingsCard>

      <SettingsCard title="Late: also tell" short="People told about a late employee besides the employee themselves.">
        <RecipientPicker
          label="Also tell"
          staff={staff}
          selected={form.lateRecipientUserIds}
          onToggle={(id) => set("lateRecipientUserIds", toggleId(form.lateRecipientUserIds, id))}
          error={errors.lateRecipientUserIds}
        />
      </SettingsCard>

      <SettingsCard
        title="Quiet hours"
        short="A message that comes up in quiet hours waits and is sent when they end."
        more={<p>Each message waits on its own, never combined with another. Hotel time (Asia/Bangkok).</p>}
        enabled={form.quietHoursEnabled}
        onToggle={(v) => set("quietHoursEnabled", v)}
        hasError={has(errors, "quietStart", "quietEnd")}
      >
        <div className="flex flex-wrap items-start gap-4">
          <div>
            <label className="eyebrow text-cream/60 block mb-1">From</label>
            <input
              type="time"
              value={form.quietStart}
              onChange={(e) => set("quietStart", e.target.value)}
              aria-invalid={errors.quietStart ? true : undefined}
              className={INPUT}
            />
            <FieldError message={errors.quietStart} />
          </div>
          <div>
            <label className="eyebrow text-cream/60 block mb-1">Until</label>
            <input type="time" value={form.quietEnd} onChange={(e) => set("quietEnd", e.target.value)} aria-invalid={errors.quietEnd ? true : undefined} className={INPUT} />
            <FieldError message={errors.quietEnd} />
          </div>
        </div>
      </SettingsCard>

      <SettingsCard title="Default language" short="For anyone without a language of their own.">
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
        <p className="text-xs text-cream/40">Set per employee on the Notification channels page.</p>
      </SettingsCard>
    </div>
  );
}
