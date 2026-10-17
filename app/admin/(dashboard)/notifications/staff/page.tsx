import Link from "next/link";
import { backendJson, backendJsonOrDefault } from "@/lib/backendServer";
import { requireRoleAtLeast } from "@/lib/rbac";
import NotificationStaffManager from "@/components/admin/NotificationStaffManager";
import type { NotificationSettings, NotificationStaffMember, NotificationStatus } from "@/lib/types";

// MANAGER+: linking a chat needs no login on the employee's side, so the people who do it are the
// managers - and GET /users is ADMIN-only, which is why the list comes from /notifications/staff.
// The default language is read from the settings only by an ADMIN (/settings/** is theirs); a manager's
// select just says "Default".
export default async function NotificationChannelsPage() {
  const user = await requireRoleAtLeast("MANAGER");

  const [staff, status, settings] = await Promise.all([
    backendJson<NotificationStaffMember[]>("/notifications/staff", { auth: true }),
    backendJsonOrDefault<NotificationStatus | null>("/notifications/status", null, { auth: true }),
    user.role === "ADMIN" ? backendJsonOrDefault<NotificationSettings | null>("/settings/notifications", null, { auth: true }) : Promise.resolve(null),
  ]);

  return (
    <div>
      <div className="mb-8">
        <p className="eyebrow text-sea mb-2">Staff</p>
        <h1 className="font-display italic text-3xl">Notification channels</h1>
        <p className="text-sm text-cream/60 mt-3 max-w-2xl">
          Link an employee's Telegram: show them the QR code or send the link, they press Start in Telegram. No login is needed. Each person's messages are written
          in the language chosen here.
        </p>
        <p className="text-sm mt-3">
          <Link href="/admin/notifications" className="text-sea hover:text-coral transition-colors">
            ← Notification log
          </Link>
        </p>
      </div>

      <NotificationStaffManager initial={staff} status={status} defaultLanguage={settings?.defaultLanguage} />
    </div>
  );
}
