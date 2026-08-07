import Link from "next/link";
import { backendJson } from "@/lib/backendServer";
import { ADMIN_API_URL } from "@/lib/backend";
import DeleteButton from "@/components/admin/DeleteButton";
import type { MenuItem } from "@/lib/posTypes";

export default async function AdminMenuPage() {
  const items = await backendJson<MenuItem[]>("/menu", { auth: true });

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <p className="eyebrow text-sea mb-2">POS</p>
          <h1 className="font-display italic text-3xl">Menu</h1>
        </div>
        <Link
          href="/admin/pos/menu/new"
          className="rounded-full bg-coral hover:bg-coraldeep transition-colors px-5 py-2.5 text-sm font-medium"
        >
          New item
        </Link>
      </div>

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
            <Link href={`/admin/pos/menu/${item.id}/edit`} className="text-sm text-sea hover:text-coral transition-colors">
              Edit
            </Link>
            <DeleteButton
              url={`${ADMIN_API_URL}/menu/${item.id}`}
              confirmText={`Delete "${item.name}"? This can't be undone.`}
            />
          </div>
        ))}
        {items.length === 0 && <p className="text-cream/50 text-sm">No menu items yet.</p>}
      </div>
    </div>
  );
}
