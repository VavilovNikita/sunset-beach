import MenuItemForm from "@/components/admin/pos/MenuItemForm";

export default function NewMenuItemPage() {
  return (
    <div>
      <p className="eyebrow text-sea mb-2">POS</p>
      <h1 className="font-display italic text-3xl mb-8">New menu item</h1>
      <MenuItemForm mode="create" />
    </div>
  );
}
