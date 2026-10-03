import { backendJsonOrDefault } from "@/lib/backendServer";
import { requireSessionUser, hasRoleAtLeast } from "@/lib/rbac";
import { parseDraftTarget } from "@/lib/posDraftOrder";
import OrderTicket from "@/components/OrderTicket";
import type { MenuItem, Table } from "@/lib/posTypes";

// A ticket that doesn't exist yet (lib/posDraftOrder.ts): opened from a free table or "New
// ticket", it writes nothing until the first item is added - then OrderTicket creates the order
// with that line and replaces this URL with /admin/pos/orders/{id}. Same role handling as the
// [id] page next to it.
export default async function NewOrderTicketPage({ searchParams }: { searchParams: { tableId?: string; guestName?: string } }) {
  const user = await requireSessionUser();
  const canManagePayments = hasRoleAtLeast(user.role, "CASHIER");
  const draft = parseDraftTarget(searchParams);

  const [menu, tables] = await Promise.all([
    backendJsonOrDefault<MenuItem[]>("/menu", [], { auth: true }),
    backendJsonOrDefault<Table[]>("/tables", [], { auth: true }),
  ]);
  const table = draft.tableId ? tables.find((t) => t.id === draft.tableId) ?? null : null;

  return (
    <div>
      <p className="eyebrow text-sea mb-2">Restaurant</p>
      <h1 className="font-display italic text-3xl mb-8">{table ? table.label : draft.guestName ?? "New ticket"}</h1>

      <OrderTicket
        initialOrder={null}
        draft={draft}
        menu={menu}
        tableZone={table?.zone ?? null}
        canManagePayments={canManagePayments}
        canVoidSentItems={false}
        basePath="/admin/pos"
        actor={null}
      />
    </div>
  );
}
