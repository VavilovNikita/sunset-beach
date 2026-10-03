import { backendJsonOrDefault } from "@/lib/backendServer";
import { getSessionUser, hasRoleAtLeast } from "@/lib/rbac";
import { parseDraftTarget } from "@/lib/posDraftOrder";
import OrderTicket from "@/components/OrderTicket";
import type { MenuItem, Table } from "@/lib/posTypes";

// A ticket that doesn't exist yet - see lib/posDraftOrder.ts and the admin twin at
// app/admin/(dashboard)/pos/orders/new/page.tsx. Nothing is written until the first item is tapped.
export default async function PosNewOrderPage({ searchParams }: { searchParams: { tableId?: string; guestName?: string } }) {
  const draft = parseDraftTarget(searchParams);
  const [user, menu, tables] = await Promise.all([
    getSessionUser(),
    backendJsonOrDefault<MenuItem[]>("/menu", [], { auth: true }),
    backendJsonOrDefault<Table[]>("/tables", [], { auth: true }),
  ]);
  const canManagePayments = !!user && hasRoleAtLeast(user.role, "CASHIER");
  const table = draft.tableId ? (tables.find((t) => t.id === draft.tableId) ?? null) : null;

  return (
    <div>
      <div className="px-4 pt-4">
        <h1 className="font-display italic text-2xl">{table ? table.label : (draft.guestName ?? "New ticket")}</h1>
      </div>
      <div className="p-4">
        <OrderTicket
          initialOrder={null}
          draft={draft}
          menu={menu}
          tableZone={table?.zone ?? null}
          canManagePayments={canManagePayments}
          basePath="/pos"
          actor={{ email: user?.email ?? "", role: user?.role ?? "WAITER" }}
        />
      </div>
    </div>
  );
}
