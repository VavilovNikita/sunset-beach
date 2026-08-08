import OrderBoard from "@/components/admin/pos/OrderBoard";
import TableManager from "@/components/admin/pos/TableManager";
import { backendJson } from "@/lib/backendServer";
import { getSessionUser, hasRoleAtLeast } from "@/lib/rbac";
import type { Order, Table } from "@/lib/posTypes";

export default async function AdminPosPage() {
  const [user, tables, openOrders, sentOrders] = await Promise.all([
    getSessionUser(),
    backendJson<Table[]>("/tables", { auth: true }),
    backendJson<Order[]>("/orders?status=OPEN", { auth: true }),
    backendJson<Order[]>("/orders?status=SENT", { auth: true }),
  ]);
  const canManageTables = !!user && hasRoleAtLeast(user.role, "MANAGER");

  return (
    <div>
      <p className="eyebrow text-sea mb-2">POS</p>
      <h1 className="font-display italic text-3xl mb-8">Tables &amp; tickets</h1>

      <OrderBoard initialTables={tables} initialOrders={[...openOrders, ...sentOrders]} />
      <TableManager initialTables={tables} canManage={canManageTables} />
    </div>
  );
}
