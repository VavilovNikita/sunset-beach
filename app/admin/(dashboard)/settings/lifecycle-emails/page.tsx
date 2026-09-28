import { backendJson } from "@/lib/backendServer";
import { requireAdminUser } from "@/lib/rbac";
import LifecycleEmailSettingsForm from "@/components/admin/LifecycleEmailSettingsForm";
import type { LifecycleEmailSettings } from "@/lib/types";

// ADMIN only, reads included - same tier as Users: these settings decide what automated email
// reaches every eligible guest (see the backend's LifecycleEmailSettings description).
export default async function LifecycleEmailSettingsPage() {
  await requireAdminUser();

  const settings = await backendJson<LifecycleEmailSettings>("/settings/lifecycle-emails", { auth: true });

  return (
    <div className="max-w-2xl">
      <div className="mb-8">
        <p className="eyebrow text-sea mb-2">Setup</p>
        <h1 className="font-display italic text-3xl">Guest emails</h1>
        <p className="text-sm text-cream/60 mt-3">
          Automated emails sent once a day at 10:00. They only go to guests who created an account on the website and
          verified their email, and every one includes an unsubscribe link. The wording is fixed; these settings control
          whether and when each one is sent.
        </p>
      </div>

      <LifecycleEmailSettingsForm initial={settings} />
    </div>
  );
}
