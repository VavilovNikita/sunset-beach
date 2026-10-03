import { notFound } from "next/navigation";
import { backendJson, backendJsonOrDefault } from "@/lib/backendServer";
import { menuCategoryTabs } from "@/lib/menuCategories";
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
  // A SPA-department item now belongs on its own screen (/admin/spa/treatments) - the restaurant
  // menu list never links here for one (see this page's own SPA filter), but a direct URL visit
  // isn't validated server-side otherwise. Same "not found" as a missing item, rather than
  // silently letting this form edit it without a duration field.
  if (item.department === "SPA") notFound();
  // Suggestions only - see the new-item page.
  const menu = await backendJsonOrDefault<MenuItem[]>("/menu", [], { auth: true });
  const existingCategories = menuCategoryTabs(menu).map((t) => t.category);

  return (
    <div>
      <p className="eyebrow text-sea mb-2">POS</p>
      <h1 className="font-display italic text-3xl mb-8">{item.name}</h1>
      <MenuItemForm
        mode="edit"
        itemId={item.id}
        existingCategories={existingCategories}
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
