import Link from "next/link";
import { backendJson } from "@/lib/backendServer";
import { requireRoleAtLeast } from "@/lib/rbac";
import ShiftHistoryTable from "@/components/admin/pos/ShiftHistoryTable";
import type { ShiftListItem } from "@/lib/posTypes";

export default async function ShiftHistoryPage({ searchParams }: { searchParams: { from?: string; to?: string } }) {
  // GET /shifts is MANAGER+ on the backend - a CASHIER's own current shift (ShiftPanel, one
  // level down at /admin/pos/shifts) is a different screen with a different purpose.
  await requireRoleAtLeast("MANAGER", "/admin/pos/shifts");
  const { from, to } = searchParams;

  const query = new URLSearchParams();
  if (from) query.set("from", from);
  if (to) query.set("to", to);

  const shifts = await backendJson<ShiftListItem[]>(`/shifts?${query.toString()}`, { auth: true });

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <p className="eyebrow text-sea mb-2">POS</p>
          <h1 className="font-display italic text-3xl">Shift history</h1>
        </div>
        <Link href="/admin/pos/shifts" className="text-sm text-sea hover:text-coral transition-colors underline underline-offset-4">
          My current shift →
        </Link>
      </div>

      <form method="get" className="flex flex-wrap items-end gap-4 mb-8 bg-ink2/40 border border-cream/10 rounded-xl p-4">
        <div>
          <label className="eyebrow text-cream/60 block mb-1">From</label>
          <input
            type="date"
            name="from"
            defaultValue={from}
            className="bg-ink2 border border-cream/20 rounded-lg px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="eyebrow text-cream/60 block mb-1">To</label>
          <input
            type="date"
            name="to"
            defaultValue={to}
            className="bg-ink2 border border-cream/20 rounded-lg px-3 py-2 text-sm"
          />
        </div>
        <button
          type="submit"
          className="rounded-full bg-coral hover:bg-coraldeep transition-colors px-5 py-2.5 text-sm font-medium"
        >
          Filter
        </button>
      </form>

      <ShiftHistoryTable shifts={shifts} />
    </div>
  );
}
