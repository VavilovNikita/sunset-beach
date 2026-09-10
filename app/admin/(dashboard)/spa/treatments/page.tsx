import Link from "next/link";
import { backendJson } from "@/lib/backendServer";
import { ADMIN_API_URL } from "@/lib/backend";
import { requireRoleAtLeast, hasRoleAtLeast } from "@/lib/rbac";
import DeleteButton from "@/components/admin/DeleteButton";
import type { MenuItem } from "@/lib/posTypes";

// GET /menu has no department filter on the backend - fetch everything and keep only SPA-
// department items here, same "filter server-side in the page" approach spa/page.tsx already
// uses for treatments in the appointment-booking grid. The restaurant menu screen
// (/admin/pos/menu) does the mirror-image filter to exclude these.
export default async function AdminSpaTreatmentsPage() {
  // Same CASHIER+ floor as the spa hub itself.
  const user = await requireRoleAtLeast("CASHIER", "/admin/pos");
  const canManage = hasRoleAtLeast(user.role, "MANAGER");

  const items = await backendJson<MenuItem[]>("/menu", { auth: true });
  const treatments = items.filter((item) => item.department === "SPA");

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <p className="eyebrow text-sea mb-2">Spa</p>
          <h1 className="font-display italic text-3xl">Treatments</h1>
        </div>
        {canManage && (
          <Link
            href="/admin/spa/treatments/new"
            className="rounded-full bg-coral hover:bg-coraldeep transition-colors px-5 py-2.5 text-sm font-medium"
          >
            New treatment
          </Link>
        )}
      </div>

      <div className="space-y-4">
        {treatments.map((item) => (
          <div key={item.id} className="flex items-center gap-4 bg-ink2/40 border border-cream/10 rounded-xl p-4">
            <div className="flex-1 min-w-0">
              <p className="font-display text-lg truncate">{item.name}</p>
              <p className="text-sm text-cream/60">
                {item.category} · ฿{Number(item.price).toLocaleString("en-US")}
                {item.durationMinutes != null && ` · ${item.durationMinutes} min`}
                {!item.isAvailable && " · Unavailable"}
              </p>
            </div>
            {canManage && (
              <>
                <Link href={`/admin/spa/treatments/${item.id}/edit`} className="text-sm text-sea hover:text-coral transition-colors">
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
        {treatments.length === 0 && <p className="text-cream/50 text-sm">No treatments yet.</p>}
      </div>
    </div>
  );
}
