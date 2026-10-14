import type { GymStatus } from "@/lib/types";

// Shown on every Gym page the moment it opens when the server has no Tuya keys (GET /gym/status -
// the server's own configuration, no Tuya call), so nobody finds out by pressing a switch and
// waiting for it to fail. Nothing is shown when the status could not be read: not knowing is not
// the same as "not configured".
export default function GymSetupBanner({ status, isAdmin }: { status: GymStatus | null; isAdmin: boolean }) {
  if (!status || status.tuyaConfigured) return null;
  return (
    <div role="status" className="mb-6 max-w-3xl rounded-xl border border-amber-400/40 bg-amber-400/10 px-4 py-3 text-sm text-amber-400">
      <p className="font-medium">Tuya is not configured</p>
      <p className="mt-1 text-amber-400/90">
        The server has no Tuya keys, so the fans and air conditioners can&rsquo;t be read or switched and a reservation won&rsquo;t switch anything.
        {isAdmin
          ? " Add TUYA_CLIENT_ID, TUYA_CLIENT_SECRET and TUYA_API_BASE to the backend settings and restart it (see DEPLOY.md, “Gym equipment”)."
          : " Ask an administrator to set the Tuya keys up."}
      </p>
    </div>
  );
}
