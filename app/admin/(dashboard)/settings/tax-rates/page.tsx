import { backendJson } from "@/lib/backendServer";
import { requireAdminUser } from "@/lib/rbac";
import TaxRatesForm from "@/components/admin/TaxRatesForm";
import type { ServiceChargeSettings, VatSettings } from "@/lib/types";

// ADMIN only, reads included - same tier as every /settings route. The rates change what the booking tracker (and the
// revenue statistic, for VAT) reports; they change nothing a guest is charged.
export default async function TaxRatesPage() {
  await requireAdminUser();

  const [vat, serviceCharge] = await Promise.all([
    backendJson<VatSettings>("/settings/vat", { auth: true }),
    backendJson<ServiceChargeSettings>("/settings/service-charge", { auth: true }),
  ]);

  return (
    <div className="max-w-2xl">
      <div className="mb-8">
        <p className="eyebrow text-sea mb-2">Reports</p>
        <h1 className="font-display italic text-3xl">Tax rates</h1>
        <p className="text-sm text-cream/60 mt-3">
          Room prices already include service charge and VAT. These two rates are only used to take them out again when the
          reports are worked out; a rate applies to the next report you open, for its whole range. Nothing here changes a price,
          a receipt or what a guest owes.
        </p>
      </div>
      <TaxRatesForm vat={vat} serviceCharge={serviceCharge} />
    </div>
  );
}
