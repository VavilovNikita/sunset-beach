import { notFound } from "next/navigation";
import { backendJson } from "@/lib/backendServer";
import { BackendError } from "@/lib/backend";
import { requireRoleAtLeast } from "@/lib/rbac";
import MenuItemForm from "@/components/admin/pos/MenuItemForm";
import type { MenuItem } from "@/lib/posTypes";

export default async function EditMenuItemPage({ params }: { params: { id: string } }) {
  await requireRoleAtLeast("MANAGER", "/admin/pos/menu");

  let item: MenuItem;
  try {
    item = await backendJson<MenuItem>(`/menu/${params.id}`, { auth: true });
  } catch (e) {
    if (e instanceof BackendError && e.status === 404) notFound();
    throw e;
  }

  return (
    <div>
      <p className="eyebrow text-sea mb-2">POS</p>
      <h1 className="font-display italic text-3xl mb-8">{item.name}</h1>
      <MenuItemForm
        mode="edit"
        itemId={item.id}
        initialValues={{
          name: item.name,
          description: item.description,
          category: item.category,
          department: item.department,
          price: Number(item.price),
          isAvailable: item.isAvailable,
        }}
      />
    </div>
  );
}
