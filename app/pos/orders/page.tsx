import Link from "next/link";
import { backendJson, backendJsonOrDefault } from "@/lib/backendServer";
import { requireRoleAtLeast } from "@/lib/rbac";
import { STATUS_LABELS, STATUS_STYLES, PAYMENT_METHOD_LABELS } from "@/lib/posOrders";
import type { Order, Shift, Table } from "@/lib/posTypes";

// Mobile deliberately doesn't offer the admin's full period/status/table/staff filter form (see
// /admin/pos/orders) - a cashier in the zал reaches for this to look something up from *their own*
// shift, not to run a manager-style review across staff and weeks. shiftId in the URL (from
// PosShiftPanel's "Orders in this shift" link) covers a past shift too, not just the current one.
export default async function PosOrderHistoryPage({ searchParams }: { searchParams: { shiftId?: string } }) {
  await requireRoleAtLeast("CASHIER", "/pos");

  let shiftId = searchParams.shiftId ?? null;
  if (!shiftId) {
    const currentShift = await backendJsonOrDefault<Shift | null>("/shifts/current", null, { auth: true });
    shiftId = currentShift?.id ?? null;
  }

  if (!shiftId) {
    return (
      <div className="p-4">
        <h1 className="font-display italic text-2xl mb-4">Orders</h1>
        <p className="text-sm text-cream/60">
          No open shift right now, and none was specified.{" "}
          <Link href="/pos/shifts" className="text-sea underline underline-offset-4">
            Open a shift →
          </Link>
        </p>
      </div>
    );
  }

  const [orders, tables] = await Promise.all([
    backendJson<Order[]>(`/orders?shiftId=${shiftId}`, { auth: true }),
    backendJsonOrDefault<Table[]>("/tables", [], { auth: true }),
  ]);
  const tablesById = new Map(tables.map((t) => [t.id, t]));

  return (
    <div className="p-4">
      <h1 className="font-display italic text-2xl mb-4">Orders in this shift</h1>

      {orders.length === 0 ? (
        <p className="text-sm text-cream/50">No orders were paid during this shift.</p>
      ) : (
        <div className="space-y-2.5">
          {orders.map((o) => (
            <Link
              key={o.id}
              href={`/pos/orders/${o.id}`}
              className="flex items-center justify-between gap-3 bg-ink2 border border-cream/10 rounded-2xl p-4 active:bg-cream/5 transition-colors"
            >
              <div className="min-w-0">
                <p className="text-cream truncate">
                  {o.tableId ? (tablesById.get(o.tableId)?.label ?? "Deleted table") : (o.guestName ?? `Ticket #${o.id.slice(-6)}`)}
                </p>
                <p className="text-xs text-cream/40 mt-0.5">
                  {o.paymentMethod ? PAYMENT_METHOD_LABELS[o.paymentMethod] : "—"} · {o.createdAt.slice(0, 16).replace("T", " ")}
                </p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-cream">฿{Number(o.total).toLocaleString("en-US")}</p>
                <span className={`text-xs rounded-full px-2 py-0.5 ${STATUS_STYLES[o.status]}`}>{STATUS_LABELS[o.status]}</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
