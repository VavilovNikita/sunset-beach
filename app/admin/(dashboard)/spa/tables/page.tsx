import { backendJsonOrDefault } from "@/lib/backendServer";
import { requireRoleAtLeast } from "@/lib/rbac";
import TableManager from "@/components/admin/pos/TableManager";
import SubpageBackLink from "@/components/admin/SubpageBackLink";
import type { Table } from "@/lib/posTypes";

// PATCH/POST/DELETE /tables are MANAGER+ on the backend. Unlike /admin/spa/map (CASHIER+ now that
// it carries live busy/free state), this is a bare label/capacity CRUD list with no read-only
// value to front desk, so there's no CASHIER view-only mode to build here.
export default async function AdminSpaTablesPage() {
  await requireRoleAtLeast("MANAGER", "/admin/pos");

  const tables = await backendJsonOrDefault<Table[]>("/tables", [], { auth: true });
  const spaTables = tables.filter((t) => t.zone === "SPA");

  return (
    <div>
      <SubpageBackLink href="/admin/spa" label="Spa schedule" />
      {/* The heading goes in through TableManager so "New table" can sit at its top right - the
          same place "New treatment" sits on Treatments. */}
      <TableManager
        initialTables={spaTables}
        canManage
        zones={["SPA"]}
        standalone
        header={
          <div>
            <p className="eyebrow text-sea mb-2">Spa</p>
            <h1 className="font-display italic text-3xl">Tables</h1>
          </div>
        }
      />
    </div>
  );
}
