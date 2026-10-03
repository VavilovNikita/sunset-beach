import MenuItemForm from "@/components/admin/pos/MenuItemForm";
import { requireRoleAtLeast } from "@/lib/rbac";
import { backendJsonOrDefault } from "@/lib/backendServer";
import { menuCategoryTabs } from "@/lib/menuCategories";
import type { MenuItem } from "@/lib/posTypes";

export default async function NewMenuItemPage() {
  await requireRoleAtLeast("MANAGER", "/admin/pos/menu");
  // Only for the category suggestions - a failed load just means no suggestions (the server still
  // refuses a near-duplicate category on save).
  const menu = await backendJsonOrDefault<MenuItem[]>("/menu", [], { auth: true });
  const existingCategories = menuCategoryTabs(menu).map((t) => t.category);

  return (
    <div>
      <p className="eyebrow text-sea mb-2">Restaurant</p>
      <h1 className="font-display italic text-3xl mb-8">New menu item</h1>
      <MenuItemForm mode="create" existingCategories={existingCategories} />
    </div>
  );
}
