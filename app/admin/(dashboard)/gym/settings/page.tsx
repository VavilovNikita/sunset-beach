import SubpageBackLink from "@/components/admin/SubpageBackLink";
import { backendJson, backendJsonOrDefault } from "@/lib/backendServer";
import { requireAdminUser } from "@/lib/rbac";
import GymSettingsManager from "@/components/admin/GymSettingsManager";
import GymHallSettingsForm from "@/components/admin/GymHallSettingsForm";
import type { GymDeviceConfig, GymHallSettings, GymTuyaUsage } from "@/lib/types";

// Everything under /gym/settings is ADMIN-only on the backend, reads included. The call counter is
// secondary data: if it cannot be read the page still opens and says so.
export default async function AdminGymSettingsPage() {
  await requireAdminUser();

  const [configs, usage, hall] = await Promise.all([
    backendJson<GymDeviceConfig[]>("/gym/settings/devices", { auth: true }),
    backendJsonOrDefault<GymTuyaUsage | null>("/gym/settings/usage", null, { auth: true }),
    backendJson<GymHallSettings>("/gym/settings/hall", { auth: true }),
  ]);

  return (
    <div>
      <SubpageBackLink href="/admin/gym" label="Gym" />
      <p className="eyebrow text-sea mb-2">Front desk</p>
      <h1 className="font-display italic text-3xl mb-4">Gym devices</h1>
      <p className="text-sm text-cream/60 mb-6 max-w-2xl">
        The gym's opening hours and what the reservation automation does, then which Tuya devices appear on the Gym page and in what order, and
        this month's Tuya call count.
      </p>
      <div className="max-w-4xl">
        <GymHallSettingsForm initial={hall} />
      </div>
      <GymSettingsManager initialConfigs={configs} usage={usage} />
    </div>
  );
}
