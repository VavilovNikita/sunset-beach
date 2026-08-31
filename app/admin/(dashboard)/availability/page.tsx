import { backendJson } from "@/lib/backendServer";
import { requireRoleAtLeast, hasRoleAtLeast } from "@/lib/rbac";
import AvailabilityManager from "@/components/admin/AvailabilityManager";
import type { Room } from "@/lib/types";

export default async function AdminAvailabilityPage() {
  // GET /rooms and GET /availability/{roomId} are both CASHIER+.
  const user = await requireRoleAtLeast("CASHIER", "/admin/pos");
  const rooms = await backendJson<Room[]>("/rooms", { auth: true });
  // Manual room blocks are MANAGER+ on the backend, same as room-unit CRUD —
  // a lower role can still browse the calendar, just not edit blocks.
  const canManage = hasRoleAtLeast(user.role, "MANAGER");

  return (
    <div>
      <p className="eyebrow text-sea mb-2">Calendar</p>
      <h1 className="font-display italic text-3xl mb-8">Availability</h1>

      {rooms.length === 0 ? (
        <p className="text-cream/50 text-sm">Add a room first.</p>
      ) : (
        <AvailabilityManager rooms={rooms.map((r) => ({ id: r.id, name: r.name }))} canManage={canManage} />
      )}
    </div>
  );
}
