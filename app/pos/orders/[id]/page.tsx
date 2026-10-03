import { notFound } from "next/navigation";
import { backendJson, backendJsonOrDefault } from "@/lib/backendServer";
import { BackendError } from "@/lib/backend";
import { getSessionUser, hasRoleAtLeast } from "@/lib/rbac";
import { orderNumberLabel, ticketTitle } from "@/lib/posOrders";
import OrderTicket from "@/components/OrderTicket";
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
  const canVoidSentItems = !!user && hasRoleAtLeast(user.role, "MANAGER");
  const table = order.tableId ? (tables.find((t) => t.id === order.tableId) ?? null) : null;

  return (
    <div>
      <div className="px-4 pt-4">
        <h1 className="font-display italic text-2xl">
          {table ? table.label : ticketTitle(order)} <span className="text-base not-italic text-cream/50">{orderNumberLabel(order)}</span>
        </h1>
      </div>
      <div className="p-4">
        <OrderTicket
          initialOrder={order}
          menu={menu}
          tableZone={table?.zone ?? null}
          canManagePayments={canManagePayments}
          canVoidSentItems={canVoidSentItems}
          basePath="/pos"
          // The phone's "will be recorded as" check before money moves, a void or a cancellation
          // (PosAttributedConfirm.tsx). The /pos layout requires a session, so `user` is non-null
          // in practice - the fallbacks only satisfy the type.
          actor={{ email: user?.email ?? "", role: user?.role ?? "WAITER" }}
        />
      </div>
    </div>
  );
}
