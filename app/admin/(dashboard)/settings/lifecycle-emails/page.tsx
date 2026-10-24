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
        <p className="eyebrow text-sea mb-2">Front desk</p>
        <h1 className="font-display italic text-3xl">Guest emails</h1>
        <p className="text-sm text-cream/60 mt-3">
          Automated emails sent once a day at 10:00. They only go to guests who created an account on the website and
          verified their email, and every one includes an unsubscribe link. The wording is fixed; these settings control
          whether and when each one is sent.
        </p>
      </div>

      <div className="mb-8 rounded-xl border border-cream/10 bg-ink2/40 px-5 py-4 text-sm text-cream/70 space-y-2">
        <p className="eyebrow text-cream/50">Who actually receives these</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>Only a guest with a website account whose email is <span className="text-cream">verified</span>, and who has not unsubscribed. One unsubscribe stops all three emails.</li>
          <li>The address used is the account&rsquo;s verified one &mdash; not the email typed on a booking.</li>
          <li>A guest card made at the front desk, or a booking from an agent (Booking.com, Airbnb &hellip;) with no account, never gets them: nobody agreed to receive marketing email there.</li>
          <li>An email is counted as sent only when the mail service accepted it; with no mail key set on the server nothing leaves and nothing is logged as sent.</li>
        </ul>
        <p className="text-xs text-cream/40">
          A sent email appears in the guest&rsquo;s card under &ldquo;Automated emails&rdquo;. A preview and an expected-recipient count are not available yet &mdash; the server does not offer them.
        </p>
      </div>

      <LifecycleEmailSettingsForm initial={settings} />
    </div>
  );
}
