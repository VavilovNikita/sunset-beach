import OrderBoard from "@/components/admin/pos/OrderBoard";
import { backendJson } from "@/lib/backendServer";
import type { Order, Table } from "@/lib/posTypes";

export default async function AdminPosPage() {
  const [tables, openOrders, sentOrders] = await Promise.all([
    backendJson<Table[]>("/tables", { auth: true }),
    backendJson<Order[]>("/orders?status=OPEN", { auth: true }),
    backendJson<Order[]>("/orders?status=SENT", { auth: true }),
  ]);

  return (
    <div>
      <p className="eyebrow text-sea mb-2">POS</p>
      <h1 className="font-display italic text-3xl mb-8">Tables &amp; tickets</h1>

      <OrderBoard initialTables={tables} initialOrders={[...openOrders, ...sentOrders]} />
    </div>
  );
}
