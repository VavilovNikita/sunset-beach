import { backendJson, backendJsonOrDefault } from "@/lib/backendServer";
import { requireAdminUser } from "@/lib/rbac";
import NotificationSettingsForm from "@/components/admin/NotificationSettingsForm";
import StaffBotSettingsForm from "@/components/admin/StaffBotSettingsForm";
import TelegramSetupBanner from "@/components/admin/TelegramSetupBanner";
import type { NotificationSettings, NotificationStaffMember, NotificationStatus, ShiftRequestDeciders, StaffBotSettings } from "@/lib/types";

// ADMIN only, reads included (everything under /settings/** is): these settings decide who is woken
// by what, and when.
export default async function NotificationSettingsPage() {
  await requireAdminUser();

  const [settings, staff, status, botSettings, deciders] = await Promise.all([
    backendJson<NotificationSettings>("/settings/notifications", { auth: true }),
    backendJson<NotificationStaffMember[]>("/notifications/staff", { auth: true }),
    // GET /notifications/status answers from the server's configuration - no call to Telegram.
    backendJsonOrDefault<NotificationStatus | null>("/notifications/status", null, { auth: true }),
    backendJson<StaffBotSettings>("/settings/staff-bot", { auth: true }),
    backendJson<ShiftRequestDeciders>("/shift-change-requests/deciders", { auth: true }),
  ]);

  return (
    <div className="max-w-2xl">
      <div className="mb-8">
        <p className="eyebrow text-sea mb-2">Staff</p>
        <h1 className="font-display italic text-3xl">Notification settings</h1>
        <p className="text-sm text-cream/60 mt-3">
          Messages to staff over Telegram: who is late, who has not come, a silent attendance terminal, a room block that needs closing. The wording is fixed
          (English, Thai and Russian); these settings control whether, when and to whom each one is sent.
        </p>
      </div>

      <TelegramSetupBanner status={status} isAdmin />
      <NotificationSettingsForm initial={settings} staff={staff} />

      <div className="mt-12">
        <h2 className="font-display italic text-2xl">Staff bot and shift requests</h2>
        <p className="text-sm text-cream/60 mt-3 mb-6">
          The same Telegram bot is each employee&rsquo;s own window onto their schedule (shifts, today, the month, requests), the HR director&rsquo;s place to
          decide requests to move or remove a shift, and a screen of its own for engineers, housekeepers, therapists and managers, with a morning summary
          for the directors. These settings are saved separately from the alerts above.
        </p>
        <StaffBotSettingsForm initial={botSettings} deciders={deciders} directorUserIds={settings.directorUserIds} staff={staff} />
      </div>
    </div>
  );
}
