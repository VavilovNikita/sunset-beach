import { prisma } from "@/lib/prisma";
import AvailabilityManager from "@/components/admin/AvailabilityManager";

export default async function AdminAvailabilityPage() {
  const rooms = await prisma.room.findMany({
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true },
  });

  return (
    <div>
      <p className="eyebrow text-sea mb-2">Calendar</p>
      <h1 className="font-display italic text-3xl mb-8">Availability</h1>

      {rooms.length === 0 ? (
        <p className="text-cream/50 text-sm">Add a room first.</p>
      ) : (
        <AvailabilityManager rooms={rooms} />
      )}
    </div>
  );
}
