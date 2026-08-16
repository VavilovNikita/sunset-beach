import { notFound } from "next/navigation";
import { backendJson, backendJsonOrDefault } from "@/lib/backendServer";
import { BackendError } from "@/lib/backend";
import OrderTicket from "@/components/admin/pos/OrderTicket";
import type { Order, MenuItem, Table } from "@/lib/posTypes";

export default async function OrderTicketPage({ params }: { params: { id: string } }) {
  let order: Order;
  try {
    order = await backendJson<Order>(`/orders/${params.id}`, { auth: true });
  } catch (e) {
    if (e instanceof BackendError && e.status === 404) notFound();
    throw e;
  }

  // Order only carries tableId, not a denormalized table. There's no
  // GET /tables/{id} on the backend — only GET /tables (list), PATCH and
  // DELETE by id — so the label is resolved by fetching the list and
  // finding the match client-side. Tables are a few dozen at most, not
  // worth avoiding.
  //
  // Neither fetch is load-bearing for the order itself — OrderTicket already
  // falls back to "Unknown item" for an item missing from `menu` and
  // AddOrderItemForm already handles an empty menu, while a missing `table`
  // just falls through to the guestName/Ticket# header below. A transient
  // failure on either shouldn't turn an otherwise-fine order into a 500.
  const [menu, tables] = await Promise.all([
    backendJsonOrDefault<MenuItem[]>("/menu", [], { auth: true }),
    backendJsonOrDefault<Table[]>("/tables", [], { auth: true }),
  ]);
  const table = order.tableId ? tables.find((t) => t.id === order.tableId) ?? null : null;

  return (
    <div>
      <p className="eyebrow text-sea mb-2">POS</p>
      <h1 className="font-display italic text-3xl mb-8">
        {table ? table.label : order.guestName ?? `Ticket #${order.id.slice(-6)}`}
      </h1>

      <OrderTicket initialOrder={order} menu={menu} />
    </div>
  );
}
