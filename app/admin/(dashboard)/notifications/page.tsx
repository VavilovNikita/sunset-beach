import Link from "next/link";
import { backendJson, backendJsonOrDefault } from "@/lib/backendServer";
import { requireRoleAtLeast } from "@/lib/rbac";
import NotificationLog from "@/components/admin/NotificationLog";
import TelegramSetupBanner from "@/components/admin/TelegramSetupBanner";
import { defaultLogFilters, logQueryString } from "@/lib/notifications";
import type { NotificationLogEntry, NotificationStatus } from "@/lib/types";

// GET /notifications/log and /status are MANAGER+ on the backend.
export default async function NotificationsPage() {
  const user = await requireRoleAtLeast("MANAGER");
  const filters = defaultLogFilters(new Date());

  const status = await backendJsonOrDefault<NotificationStatus | null>("/notifications/status", null, { auth: true });
  let entries: NotificationLogEntry[] = [];
  let loadError: string | null = null;
  try {
    entries = await backendJson<NotificationLogEntry[]>(`/notifications/log?${logQueryString(filters)}`, { auth: true });
  } catch {
    // Not an empty list: an empty log and a log that could not be read mean different things.
    loadError = "Could not load the notification log. Press Refresh to try again.";
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-8">
        <div>
          <p className="eyebrow text-sea mb-2">Staff</p>
          <h1 className="font-display italic text-3xl">Notifications</h1>
          <p className="text-sm text-cream/60 mt-3 max-w-2xl">What was sent to whom, and whether it arrived. Dates are hotel days.</p>
        </div>
        <div className="flex gap-3 text-sm">
          <Link href="/admin/notifications/staff" className="rounded-full border border-cream/25 hover:border-coral px-4 py-2.5 min-h-[44px] inline-flex items-center transition-colors">
            Notification channels
          </Link>
          {user.role === "ADMIN" && (
            <Link href="/admin/settings/notifications" className="rounded-full border border-cream/25 hover:border-coral px-4 py-2.5 min-h-[44px] inline-flex items-center transition-colors">
              Settings
            </Link>
          )}
        </div>
      </div>

      <TelegramSetupBanner status={status} isAdmin={user.role === "ADMIN"} />
      <NotificationLog initialEntries={entries} initialFilters={filters} initialError={loadError} />
    </div>
  );
}
