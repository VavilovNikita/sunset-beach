import { notFound } from "next/navigation";
import { backendJson, backendJsonOrDefault } from "@/lib/backendServer";
import { BackendError } from "@/lib/backend";
import { getSessionUser, hasRoleAtLeast } from "@/lib/rbac";
import PosOrderTicket from "@/components/pos/PosOrderTicket";
import type { Order, MenuItem, Table } from "@/lib/posTypes";

export default async function PosOrderPage({ params }: { params: { id: string } }) {
  let order: Order;
  try {
    order = await backendJson<Order>(`/orders/${params.id}`, { auth: true });
  } catch (e) {
    if (e instanceof BackendError && e.status === 404) notFound();
    throw e;
  }

  // Neither fetch below is load-bearing for the order itself (see the admin OrderTicket page's
  // identical comment) — a transient failure on either shouldn't turn an otherwise-fine order
  // into a hard error.
  const [user, menu, tables] = await Promise.all([
    getSessionUser(),
    backendJsonOrDefault<MenuItem[]>("/menu", [], { auth: true }),
    backendJsonOrDefault<Table[]>("/tables", [], { auth: true }),
  ]);
  const canManagePayments = !!user && hasRoleAtLeast(user.role, "CASHIER");
  const table = order.tableId ? (tables.find((t) => t.id === order.tableId) ?? null) : null;

  return (
    <div>
      <div className="px-4 pt-4">
        <h1 className="font-display italic text-2xl">
          {table ? table.label : (order.guestName ?? `Ticket #${order.id.slice(-6)}`)}
        </h1>
      </div>
      <PosOrderTicket
        initialOrder={order}
        menu={menu}
        canManagePayments={canManagePayments}
        // Only ever rendered when canManagePayments is true, which already implies `user` is
        // non-null - the fallbacks below are unreachable in practice, just satisfying the type.
        actorEmail={user?.email ?? ""}
        actorRole={user?.role ?? "WAITER"}
      />
    </div>
  );
}
