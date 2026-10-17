import SubpageBackLink from "@/components/admin/SubpageBackLink";
import { backendJson, backendJsonOrDefault } from "@/lib/backendServer";
import { requireAdminUser } from "@/lib/rbac";
import LightingSettingsManager from "@/components/admin/LightingSettingsManager";
import LightingSetupBanner from "@/components/admin/LightingSetupBanner";
import type { LightingDeviceConfig, LightingStatus } from "@/lib/types";

// Everything under /lighting/settings is ADMIN-only on the backend, reads included. The saved controllers can
// always be listed, renamed, hidden, reordered and deleted; adding one, checking an address and changing it need
// the server's allowed subnet (GET /lighting/status says whether it is set).
export default async function AdminLightingSettingsPage() {
  await requireAdminUser();

  const [configs, status] = await Promise.all([
    backendJson<LightingDeviceConfig[]>("/lighting/settings/devices", { auth: true }),
    backendJsonOrDefault<LightingStatus | null>("/lighting/status", null, { auth: true }),
  ]);
  // Not knowing is not the same as "not configured": only an explicit false switches adding off.
  const configured = status?.configured !== false;

  return (
    <div>
      <SubpageBackLink href="/admin/lighting" label="Lighting" />
      <p className="eyebrow text-sea mb-2">Front desk</p>
      <h1 className="font-display italic text-3xl mb-4">Lighting devices</h1>
      <p className="text-sm text-cream/60 mb-6 max-w-2xl">Which lighting controllers appear on the Lighting page, at which address, and in what order.</p>
      {!configured && <LightingSetupBanner isAdmin />}
      <LightingSettingsManager initialConfigs={configs} configured={configured} />
    </div>
  );
}
