import MenuItemForm from "@/components/admin/pos/MenuItemForm";
import { requireRoleAtLeast } from "@/lib/rbac";

export default async function NewMenuItemPage() {
  await requireRoleAtLeast("MANAGER", "/admin/pos/menu");

  return (
    <div>
      <p className="eyebrow text-sea mb-2">POS</p>
      <h1 className="font-display italic text-3xl mb-8">New menu item</h1>
      <MenuItemForm mode="create" />
    </div>
  );
}
