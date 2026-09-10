import { backendJsonOrDefault } from "@/lib/backendServer";
import { requireRoleAtLeast } from "@/lib/rbac";
import TableManager from "@/components/admin/pos/TableManager";
import type { Table } from "@/lib/posTypes";

// PATCH/POST/DELETE /tables are MANAGER+ on the backend - same floor as the spa table map
// (/admin/spa/map), and same reasoning: a bare table list has no read-only value to front desk
// the way live occupancy does, so there's no CASHIER view-only mode to build here.
export default async function AdminSpaTablesPage() {
  await requireRoleAtLeast("MANAGER", "/admin/pos");

  const tables = await backendJsonOrDefault<Table[]>("/tables", [], { auth: true });
  const spaTables = tables.filter((t) => t.zone === "SPA");

  return (
    <div>
      <p className="eyebrow text-sea mb-2">Spa</p>
      <h1 className="font-display italic text-3xl mb-8">Tables</h1>
      <TableManager initialTables={spaTables} canManage zones={["SPA"]} standalone />
    </div>
  );
}
