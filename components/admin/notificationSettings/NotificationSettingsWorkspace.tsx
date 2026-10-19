"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AttendanceAlertsPanel, RecipientsPanel, RoomBlocksPanel } from "@/components/admin/notificationSettings/AlertPanels";
import BotPanel from "@/components/admin/notificationSettings/BotPanels";
import NotificationOverview from "@/components/admin/notificationSettings/NotificationOverview";
import SettingsTabLink from "@/components/admin/notificationSettings/SettingsTabLink";
import { saveNotificationSettings } from "@/lib/notificationClient";
import {
  overviewFacts,
  overviewSections,
  parseSettingsTab,
  prepareSave,
  SETTINGS_TABS,
  tabsWithEdits,
  tabsWithErrors,
  unsavedSummary,
  type SettingsTabId,
} from "@/lib/notificationSettingsTabs";
import { dirtySettingsFields, settingsServerError, toSettingsForm, type SettingsFieldErrors, type SettingsForm } from "@/lib/notifications";
import { saveStaffBotSettings } from "@/lib/shiftRequestClient";
import {
  botSettingsServerError,
  dirtyBotSettingsFields,
  directorsTelegramSummary,
  toBotSettingsForm,
  type BotSettingsFieldErrors,
  type BotSettingsForm,
} from "@/lib/staffBotSettings";
import type { NotificationSettings, NotificationStaffMember, ShiftRequestDeciders, StaffBotSettings, NotificationStatus } from "@/lib/types";

const PRIMARY = "min-h-[44px] rounded-full bg-coral hover:bg-coraldeep transition-colors px-5 text-sm font-medium disabled:opacity-60";
const SECONDARY = "min-h-[44px] px-3 text-sm text-cream/70 hover:text-cream transition-colors disabled:opacity-60";

// ADMIN. The notification settings page: two settings documents (the alerts, PUT /settings/notifications, and the
// staff bot, PUT /settings/staff-bot) edited as one. Both forms live here, so an edit survives a change of tab (the
// tab is `?tab=` in the address); the tab with an unsaved edit has a dot; one Save sends the document(s) that
// changed, each whole, and one failing leaves the other saved. What the page shows after a save is what the server
// answered. The HR director's leave saves by itself, at once, and is not part of this.
export default function NotificationSettingsWorkspace({
  initialAlerts,
  initialBot,
  initialDeciders,
  staff,
  status,
}: {
  initialAlerts: NotificationSettings;
  initialBot: StaffBotSettings;
  initialDeciders: ShiftRequestDeciders;
  staff: NotificationStaffMember[];
  status: NotificationStatus | null;
}) {
  const tab = parseSettingsTab(useSearchParams().get("tab"));

  const [alertsSaved, setAlertsSaved] = useState(initialAlerts);
  const [botSaved, setBotSaved] = useState(initialBot);
  const [alertForm, setAlertForm] = useState<SettingsForm>(() => toSettingsForm(initialAlerts));
  const [botForm, setBotForm] = useState<BotSettingsForm>(() => toBotSettingsForm(initialBot));
  const [alertErrors, setAlertErrors] = useState<SettingsFieldErrors>({});
  const [botErrors, setBotErrors] = useState<BotSettingsFieldErrors>({});
  const [deciders, setDeciders] = useState(initialDeciders);
  const [saving, setSaving] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const activeStaff = useMemo(() => staff.filter((m) => m.isActive), [staff]);
  const alertFields = dirtySettingsFields(alertForm, alertsSaved);
  const botFields = dirtyBotSettingsFields(botForm, botSaved);
  const editedTabs = tabsWithEdits(alertFields, botFields);
  const errorTabs = tabsWithErrors(alertErrors, botErrors);
  const dirty = editedTabs.length > 0;
  const formMessages = [alertErrors.form && `Alerts: ${alertErrors.form}`, botErrors.form && `Staff bot: ${botErrors.form}`].filter(Boolean) as string[];

  // The summary names the directors as typed: that is who will get it once saved.
  const directors = directorsTelegramSummary(alertForm.directorUserIds, staff);
  // The Overview says what is running now: the directors as saved.
  const savedDirectors = directorsTelegramSummary(alertsSaved.directorUserIds, staff);

  // A page with unsaved edits asks before it is closed or reloaded (the browser's own prompt).
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  // The success note goes by itself; with nothing unsaved the bar is then gone.
  useEffect(() => {
    if (!note) return;
    const timer = window.setTimeout(() => setNote(null), 4000);
    return () => window.clearTimeout(timer);
  }, [note]);

  // On a phone the tab row scrolls; keep the open tab in view when the address changes.
  const rowRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    rowRef.current?.querySelector<HTMLElement>("[aria-current=page]")?.scrollIntoView({ block: "nearest", inline: "center" });
  }, [tab]);

  function setAlert<K extends keyof SettingsForm>(key: K, value: SettingsForm[K]) {
    setAlertForm((f) => ({ ...f, [key]: value }));
    setAlertErrors((e) => ({ ...e, [key]: undefined, form: undefined }));
    setNote(null);
  }

  function setBot<K extends keyof BotSettingsForm>(key: K, value: BotSettingsForm[K]) {
    setBotForm((f) => ({ ...f, [key]: value }));
    setBotErrors((e) => ({ ...e, [key]: undefined, form: undefined }));
    setNote(null);
  }

  function goTo(id: SettingsTabId) {
    window.history.pushState(null, "", id === "overview" ? window.location.pathname : `${window.location.pathname}?tab=${id}`);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setNote(null);
    const prepared = prepareSave(alertForm, alertsSaved, botForm, botSaved);
    if (!prepared.ok) {
      setAlertErrors(prepared.alertErrors);
      setBotErrors(prepared.botErrors);
      goTo(prepared.tab);
      return;
    }
    setAlertErrors({});
    setBotErrors({});
    setSaving(true);
    // Independent documents: both are sent, and each outcome is applied by itself.
    const [alertResult, botResult] = await Promise.all([
      prepared.alerts ? saveNotificationSettings(prepared.alerts) : null,
      prepared.bot ? saveStaffBotSettings(prepared.bot) : null,
    ]);
    setSaving(false);

    let nextAlertErrors: SettingsFieldErrors = {};
    let nextBotErrors: BotSettingsFieldErrors = {};
    let failed = false;
    if (alertResult) {
      if (alertResult.ok) {
        setAlertsSaved(alertResult.data);
        setAlertForm(toSettingsForm(alertResult.data));
      } else {
        failed = true;
        const { field, message } = settingsServerError(alertResult.status, alertResult.error, alertResult.body);
        nextAlertErrors = { [field]: message };
      }
    }
    if (botResult) {
      if (botResult.ok) {
        setBotSaved(botResult.data);
        setBotForm(toBotSettingsForm(botResult.data));
      } else {
        failed = true;
        const { field, message } = botSettingsServerError(botResult.status, botResult.error, botResult.body);
        nextBotErrors = { [field]: message };
      }
    }
    setAlertErrors(nextAlertErrors);
    setBotErrors(nextBotErrors);
    if (!failed) {
      setNote("Saved.");
      return;
    }
    const first = tabsWithErrors(nextAlertErrors, nextBotErrors)[0];
    if (first) goTo(first);
    const saved = [alertResult?.ok && "alerts", botResult?.ok && "staff bot"].filter(Boolean);
    if (saved.length > 0) setNote(`Saved: ${saved.join(", ")}. The rest was not saved.`);
  }

  function handleDiscard() {
    setAlertForm(toSettingsForm(alertsSaved));
    setBotForm(toBotSettingsForm(botSaved));
    setAlertErrors({});
    setBotErrors({});
    setNote(null);
  }

  const alertProps = { form: alertForm, set: setAlert, errors: alertErrors, staff: activeStaff, minLateGraceMinutes: alertsSaved.minLateGraceMinutes };
  const botProps = { tab, form: botForm, set: setBot, errors: botErrors, deciders, onDecidersSaved: setDeciders, directors };
  const showBar = dirty || note !== null || formMessages.length > 0;

  return (
    <form onSubmit={handleSave} className="space-y-6">
      <nav aria-label="Sections" className="border-b border-cream/10">
        <div ref={rowRef} className="flex gap-1 overflow-x-auto pb-px -mb-px">
          {SETTINGS_TABS.map((t) => {
            const current = t.id === tab;
            const hasError = errorTabs.includes(t.id);
            const edited = editedTabs.includes(t.id);
            return (
              <SettingsTabLink
                key={t.id}
                tab={t.id}
                current={current}
                className={`shrink-0 whitespace-nowrap inline-flex items-center min-h-[44px] px-4 text-sm border-b-2 transition-colors ${
                  current ? "border-coral text-cream" : "border-transparent text-cream/60 hover:text-cream"
                }`}
              >
                {t.label}
                {hasError ? (
                  <span className="ml-1.5 text-coral" title="Has an error" aria-label="has an error">
                    ▲
                  </span>
                ) : (
                  edited && (
                    <span className="ml-1.5 text-amber-400" title="Unsaved changes" aria-label="unsaved changes">
                      ●
                    </span>
                  )
                )}
              </SettingsTabLink>
            );
          })}
        </div>
      </nav>

      {tab === "overview" && (
        <NotificationOverview
          facts={overviewFacts(alertsSaved, staff, deciders, status, savedDirectors)}
          sections={overviewSections(alertsSaved, botSaved, savedDirectors)}
        />
      )}
      {tab === "attendance" && <AttendanceAlertsPanel {...alertProps} />}
      {tab === "blocks" && <RoomBlocksPanel {...alertProps} />}
      {tab === "recipients" && <RecipientsPanel {...alertProps} />}
      {(tab === "bot" || tab === "requests" || tab === "roles" || tab === "summary") && <BotPanel {...botProps} />}

      {showBar && (
        <div
          role="region"
          aria-label="Unsaved changes"
          className="sticky bottom-4 z-20 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-cream/20 bg-ink2 px-4 py-3 shadow-lg"
        >
          <div className="min-w-0 flex-1 text-sm">
            {dirty && <p className="text-cream">{unsavedSummary(editedTabs)}</p>}
            {formMessages.map((m) => (
              <p key={m} className="text-coral">
                {m}
              </p>
            ))}
            {note && <p className="text-cream/70" role="status">{note}</p>}
          </div>
          {dirty && (
            <>
              <button type="button" onClick={handleDiscard} disabled={saving} className={SECONDARY}>
                Discard
              </button>
              <button type="submit" disabled={saving} className={PRIMARY}>
                {saving ? "Saving…" : "Save"}
              </button>
            </>
          )}
        </div>
      )}
    </form>
  );
}
