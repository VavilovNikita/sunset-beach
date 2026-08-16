import Link from "next/link";
import { backendJson } from "@/lib/backendServer";
import { requireRoleAtLeast } from "@/lib/rbac";
import PrinterManager from "@/components/admin/pos/PrinterManager";
import type { Printer } from "@/lib/posTypes";

// Unlike TableManager/menu (viewable by any staff, mutations hidden behind
// canManage), GET /printers itself is MANAGER+ on the backend — there's no
// lower-privilege read to fall back to, so the whole page redirects rather
// than rendering a degraded view.
export default async function AdminPrintersPage() {
  await requireRoleAtLeast("MANAGER", "/admin/pos");

  const printers = await backendJson<Printer[]>("/printers", { auth: true });

  return (
    <div>
      <p className="eyebrow text-sea mb-2">POS</p>
      <h1 className="font-display italic text-3xl mb-8">Printers</h1>
      <p className="text-sm text-cream/60 mb-6 max-w-2xl">
        Each department (Kitchen, Bar, Cashier) can have at most one active printer. Use{" "}
        <span className="text-cream/80">Test print</span> after adding or editing one to confirm the host/port/codepage
        are actually right — a printer that looks configured but isn&rsquo;t reachable will silently queue failed jobs
        instead of tickets. Failed jobs show up in the{" "}
        <Link href="/admin/pos/print-jobs" className="text-sea hover:text-coral transition-colors underline underline-offset-4">
          print queue
        </Link>
        .
      </p>
      <PrinterManager initialPrinters={printers} />
    </div>
  );
}
