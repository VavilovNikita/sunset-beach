"use client";

import HrVacationForm from "@/components/admin/HrVacationForm";
import SettingsCard from "@/components/admin/notificationSettings/SettingsCard";
import { CheckField, NumberField, TimeField } from "@/components/admin/notificationSettings/fields";
import { BOT_GROUP_TAB, type SettingsTabId } from "@/lib/notificationSettingsTabs";
import { decidersSummary } from "@/lib/shiftRequests";
import {
  BOT_GROUPS,
  BOT_NUMBER_FIELDS,
  BOT_TIME_FIELDS,
  type BotGroup,
  type BotNumberKey,
  type BotSettingsFieldErrors,
  type BotSettingsForm,
  type BotTimeKey,
  type BotToggleKey,
  type DirectorsTelegram,
} from "@/lib/staffBotSettings";
import type { ShiftRequestDeciders } from "@/lib/types";

export type BotPanelProps = {
  tab: SettingsTabId;
  form: BotSettingsForm;
  set: <K extends keyof BotSettingsForm>(key: K, value: BotSettingsForm[K]) => void;
  errors: BotSettingsFieldErrors;
  deciders: ShiftRequestDeciders;
  onDecidersSaved: (next: ShiftRequestDeciders) => void;
  directors: DirectorsTelegram;
};

// The tabs that are the staff bot settings (PUT /settings/staff-bot): the cards of BOT_GROUPS, sorted onto tabs by
// BOT_GROUP_TAB. Same fields and labels as before.
export default function BotPanel({ tab, form, set, errors, deciders, onDecidersSaved, directors }: BotPanelProps) {
  const groups = BOT_GROUPS.filter((g) => BOT_GROUP_TAB[g.id] === tab);

  const number = (key: BotNumberKey) => {
    const f = BOT_NUMBER_FIELDS.find((n) => n.key === key)!;
    return <NumberField key={key} label={f.label} unit={f.unit} hint={f.hint} value={form[key]} onChange={(v) => set(key, v)} error={errors[key]} />;
  };
  const time = (key: BotTimeKey) => {
    const f = BOT_TIME_FIELDS.find((n) => n.key === key)!;
    return <TimeField key={key} label={f.label} value={form[key]} onChange={(v) => set(key, v)} error={errors[key]} />;
  };
  const toggle = (key: BotToggleKey, label: string, hint?: string) => (
    <CheckField
      key={key}
      label={label}
      hint={hint}
      checked={form[key]}
      onChange={(v) => set(key, v)}
      below={
        key === "morningSummaryEnabled" ? (
          <p className={`text-xs ml-6 mt-1 ${directors.selected === 0 || directors.linked === 0 ? "text-amber-400" : "text-cream/60"}`}>{directors.text}</p>
        ) : undefined
      }
    />
  );

  const card = (group: BotGroup) => {
    const fieldKeys: string[] = [...group.toggles.map((t) => t.key as string), ...group.numbers, ...group.times];
    const hasError = fieldKeys.some((k) => Boolean(errors[k as keyof BotSettingsForm]));
    const master = group.master ? group.toggles.find((t) => t.key === group.master) : undefined;
    const rest = group.toggles.filter((t) => t !== master);
    const body = (
      <>
        {master?.hint && <p className="text-xs text-cream/40">{master.hint}</p>}
        {rest.map((t) => toggle(t.key, t.label, t.hint))}
        {group.numbers.map((key) => number(key))}
        {group.times.map((key) => time(key))}
      </>
    );
    const requestsMore =
      group.id === "requests" ? (
        <p>
          An employee can ask to move a shift to a free day or to take it off; the HR director decides in the bot or on the Shift requests page. Approving
          changes the roster. {decidersSummary(deciders)}
        </p>
      ) : undefined;
    return (
      <SettingsCard
        key={group.id}
        title={group.title}
        short={group.short}
        more={requestsMore ?? (group.note ? <p>{group.note}</p> : undefined)}
        enabled={master ? form[master.key] : undefined}
        onToggle={master ? (v) => set(master.key, v) : undefined}
        switchLabel={master?.label}
        hasError={hasError}
      >
        {body}
      </SettingsCard>
    );
  };

  return (
    <div className="grid gap-4 lg:grid-cols-2 items-start">
      {groups.map(card)}
      {tab === "requests" && (
        <SettingsCard
          title="HR director's leave"
          short="Saved at once with its own button - not by Save at the bottom."
          more={<p>While the HR director is away, requests go to the administrators if the switch above lets them cover.</p>}
        >
          {/* Enter in a date field must not submit the page's Save: the leave has its own button. */}
          <div onKeyDown={(e) => e.key === "Enter" && e.preventDefault()}>
            <HrVacationForm deciders={deciders} onSaved={onDecidersSaved} />
          </div>
        </SettingsCard>
      )}
    </div>
  );
}
