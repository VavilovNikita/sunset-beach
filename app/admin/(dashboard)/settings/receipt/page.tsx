import { backendJson } from "@/lib/backendServer";
import { requireAdminUser } from "@/lib/rbac";
import ReceiptSettingsForm from "@/components/admin/ReceiptSettingsForm";
import type { ReceiptSettings } from "@/lib/types";

// ADMIN only, like every /settings page. Applies to the guest receipt and the pre-bill; the
// kitchen/bar tickets and the Z report are working documents and aren't configurable here.
export default async function ReceiptSettingsPage() {
  await requireAdminUser();

  const settings = await backendJson<ReceiptSettings>("/settings/receipt", { auth: true });

  return (
    <div>
      <div className="mb-8 max-w-2xl">
        <p className="eyebrow text-sea mb-2">Restaurant</p>
        <h1 className="font-display italic text-3xl">Receipt layout</h1>
        <p className="text-sm text-cream/60 mt-3">
          How the guest receipt and the pre-bill look on paper: paper width, font, logo, header and footer, and which lines
          appear. Changes apply to the next one printed.
        </p>
      </div>

      <ReceiptSettingsForm initial={settings} />
    </div>
  );
}
