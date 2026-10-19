import { Suspense } from "react";
import { backendJson, backendJsonOrDefault } from "@/lib/backendServer";
import { requireAdminUser } from "@/lib/rbac";
import NotificationSettingsWorkspace from "@/components/admin/notificationSettings/NotificationSettingsWorkspace";
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
    <div className="max-w-5xl">
      <div className="mb-6 max-w-2xl">
        <p className="eyebrow text-sea mb-2">Staff</p>
        <h1 className="font-display italic text-3xl">Notification settings</h1>
        <p className="text-sm text-cream/60 mt-3">
          Telegram messages to staff and what the staff bot offers each employee. The wording is fixed (English, Thai and Russian); these settings
          control whether, when and to whom each one is sent.
        </p>
      </div>

      <TelegramSetupBanner status={status} isAdmin />
      {/* The tab is `?tab=` of the address, which the workspace reads (useSearchParams needs a Suspense boundary). */}
      <Suspense fallback={null}>
        <NotificationSettingsWorkspace
          initialAlerts={settings}
          initialBot={botSettings}
          initialDeciders={deciders}
          staff={staff}
          status={status}
        />
      </Suspense>
    </div>
  );
}
