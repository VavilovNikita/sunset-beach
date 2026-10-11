import { backendJson } from "@/lib/backendServer";
import { requireAdminUser } from "@/lib/rbac";
import PrintLayoutEditor from "@/components/admin/PrintLayoutEditor";
import type { PrintLayouts } from "@/lib/types";

// ADMIN only, like every /settings page. One tab per printed document: guest receipt, pre-bill,
// kitchen ticket, bar ticket, Z-report.
export default async function PrintLayoutsPage() {
  await requireAdminUser();

  const layouts = await backendJson<PrintLayouts>("/settings/print-layouts", { auth: true });

  return (
    <div>
      <div className="mb-8 max-w-2xl">
        <p className="eyebrow text-sea mb-2">Restaurant</p>
        <h1 className="font-display italic text-3xl">Print layouts</h1>
        <p className="text-sm text-cream/60 mt-3">
          How each printed document looks on paper: the guest receipt, pre-bill, kitchen and bar tickets and the Z-report.
          Paper width, font, sizes, header and footer, and which lines appear. Changes apply to the next one printed.
        </p>
      </div>

      <PrintLayoutEditor initial={layouts} />
    </div>
  );
}
