import Link from "next/link";
import { backendJson } from "@/lib/backendServer";
import { ADMIN_API_URL } from "@/lib/backend";
import { getSessionUser, hasRoleAtLeast } from "@/lib/rbac";
import { MENU_DEPARTMENT_LABELS } from "@/lib/posOrders";
import DeleteButton from "@/components/admin/DeleteButton";
import type { MenuItem } from "@/lib/posTypes";

export default async function AdminMenuPage() {
  const [user, items] = await Promise.all([
    getSessionUser(),
    backendJson<MenuItem[]>("/menu", { auth: true }),
  ]);
  const canManage = !!user && hasRoleAtLeast(user.role, "MANAGER");

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <p className="eyebrow text-sea mb-2">POS</p>
          <h1 className="font-display italic text-3xl">Menu</h1>
        </div>
        {canManage && (
          <Link
            href="/admin/pos/menu/new"
            className="rounded-full bg-coral hover:bg-coraldeep transition-colors px-5 py-2.5 text-sm font-medium"
          >
            New item
          </Link>
        )}
      </div>

      {/* Department was backfilled to KITCHEN on every existing row when this
          column was added — drinks still need reassigning to BAR by hand, so
          it's shown here as its own badge (not folded into the category
          line) to make the leftover KITCHEN drinks easy to spot at a glance. */}
      <div className="space-y-4">
        {items.map((item) => (
          <div
            key={item.id}
            className="flex items-center gap-4 bg-ink2/40 border border-cream/10 rounded-xl p-4"
          >
            <div className="flex-1 min-w-0">
              <p className="font-display text-lg truncate">{item.name}</p>
              <p className="text-sm text-cream/60">
                {item.category} · ฿{Number(item.price).toLocaleString("en-US")}
                {!item.isAvailable && " · Unavailable"}
              </p>
            </div>
            <span
              className={`text-xs rounded-full px-3 py-1 shrink-0 ${
                item.department === "BAR" ? "bg-sea/15 text-sea" : "bg-cream/10 text-cream/60"
              }`}
            >
              {MENU_DEPARTMENT_LABELS[item.department]}
            </span>
            {canManage && (
              <>
                <Link href={`/admin/pos/menu/${item.id}/edit`} className="text-sm text-sea hover:text-coral transition-colors">
                  Edit
                </Link>
                <DeleteButton
                  url={`${ADMIN_API_URL}/menu/${item.id}`}
                  confirmText={`Delete "${item.name}"? This can't be undone.`}
                />
              </>
            )}
          </div>
        ))}
        {items.length === 0 && <p className="text-cream/50 text-sm">No menu items yet.</p>}
      </div>
    </div>
  );
}
