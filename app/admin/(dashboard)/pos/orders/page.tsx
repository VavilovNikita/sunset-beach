import Link from "next/link";
import { backendJson } from "@/lib/backendServer";
import { requireRoleAtLeast } from "@/lib/rbac";
import OrderHistoryTable from "@/components/admin/pos/OrderHistoryTable";
import type { Order, Table } from "@/lib/posTypes";

function isoDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

export default async function OrderHistoryPage({
  searchParams,
}: {
  searchParams: { from?: string; to?: string; status?: string; tableId?: string; shiftId?: string };
}) {
  // GET /orders itself has no role floor above "any authenticated staff" (the whole floor
  // already sees every table's orders), but this particular screen - unbounded lookback,
  // every status including OPEN/SENT, a staff filter - is the till-reconciliation/dispute-review
  // tool a manager reaches for, not something a WAITER/CASHIER needs a link to. The live floor
  // board (/admin/pos) already covers "what's open right now" for everyone.
  await requireRoleAtLeast("MANAGER", "/admin/pos");

  const today = new Date();
  const defaultFrom = new Date(today);
  defaultFrom.setDate(defaultFrom.getDate() - 7);
  const from = searchParams.from || isoDate(defaultFrom);
  const to = searchParams.to || isoDate(today);
  const { status, tableId, shiftId } = searchParams;

  const query = new URLSearchParams({ from, to });
  if (status) query.set("status", status);
  if (tableId) query.set("tableId", tableId);
  if (shiftId) query.set("shiftId", shiftId);

  const [orders, tables] = await Promise.all([
    backendJson<Order[]>(`/orders?${query.toString()}`, { auth: true }),
    backendJson<Table[]>("/tables", { auth: true }),
  ]);

  return (
    <div>
      <div className="flex items-center justify-between gap-4 flex-wrap mb-8">
        <div>
          <p className="eyebrow text-sea mb-2">POS</p>
          <h1 className="font-display italic text-3xl">Order history</h1>
        </div>
        <Link href="/admin/pos" className="text-sm text-sea hover:text-coral transition-colors underline underline-offset-4">
          Tables &amp; tickets →
        </Link>
      </div>

      {shiftId && (
        <p className="text-sm text-cream/60 mb-6 bg-ink2/40 border border-cream/10 rounded-xl px-4 py-3">
          Showing only orders paid during one shift.{" "}
          <Link
            href={`/admin/pos/orders?from=${from}&to=${to}`}
            className="text-sea hover:text-coral transition-colors underline underline-offset-4"
          >
            Clear that filter
          </Link>
        </p>
      )}

      <form method="get" className="flex flex-wrap items-end gap-4 mb-8 bg-ink2/40 border border-cream/10 rounded-xl p-4">
        {shiftId && <input type="hidden" name="shiftId" value={shiftId} />}
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
        <div>
          <label className="eyebrow text-cream/60 block mb-1">Status</label>
          <select
            name="status"
            defaultValue={status ?? ""}
            className="bg-ink2 border border-cream/20 rounded-lg px-3 py-2 text-sm"
          >
            <option value="">All</option>
            <option value="OPEN">Open</option>
            <option value="SENT">Sent</option>
            <option value="PAID">Paid</option>
            <option value="CANCELLED">Cancelled</option>
          </select>
        </div>
        <div>
          <label className="eyebrow text-cream/60 block mb-1">Table</label>
          <select
            name="tableId"
            defaultValue={tableId ?? ""}
            className="bg-ink2 border border-cream/20 rounded-lg px-3 py-2 text-sm"
          >
            <option value="">All tables</option>
            {tables.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
        <button
          type="submit"
          className="rounded-full bg-coral hover:bg-coraldeep transition-colors px-5 py-2.5 text-sm font-medium"
        >
          Filter
        </button>
      </form>

      <OrderHistoryTable orders={orders} tables={tables} />
    </div>
  );
}
