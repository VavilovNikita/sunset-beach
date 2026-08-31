import { requireRoleAtLeast } from "@/lib/rbac";
import RoomForm from "@/components/admin/RoomForm";

export default async function NewRoomPage() {
  // POST /rooms is MANAGER+ on the backend; the list page no longer links
  // here for anyone else, but a direct URL still shouldn't reach a form
  // whose submit would just come back 403.
  await requireRoleAtLeast("MANAGER", "/admin/rooms");

  return (
    <div>
      <p className="eyebrow text-sea mb-2">Inventory</p>
      <h1 className="font-display italic text-3xl mb-8">New room</h1>
      <RoomForm mode="create" />
    </div>
  );
}
