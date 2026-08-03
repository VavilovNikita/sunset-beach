import { backendJson } from "@/lib/backendServer";
import AvailabilityManager from "@/components/admin/AvailabilityManager";
import type { Room } from "@/lib/types";

export default async function AdminAvailabilityPage() {
  const rooms = await backendJson<Room[]>("/rooms", { auth: true });

  return (
    <div>
      <p className="eyebrow text-sea mb-2">Calendar</p>
      <h1 className="font-display italic text-3xl mb-8">Availability</h1>

      {rooms.length === 0 ? (
        <p className="text-cream/50 text-sm">Add a room first.</p>
      ) : (
        <AvailabilityManager rooms={rooms.map((r) => ({ id: r.id, name: r.name }))} />
      )}
    </div>
  );
}
