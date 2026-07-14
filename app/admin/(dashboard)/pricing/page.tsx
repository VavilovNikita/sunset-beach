import { prisma } from "@/lib/prisma";
import PricingManager from "@/components/admin/PricingManager";

export default async function AdminPricingPage() {
  const rooms = await prisma.room.findMany({
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true },
  });

  return (
    <div>
      <p className="eyebrow text-sea mb-2">Rates</p>
      <h1 className="font-display italic text-3xl mb-8">Pricing</h1>

      {rooms.length === 0 ? (
        <p className="text-cream/50 text-sm">Add a room first.</p>
      ) : (
        <PricingManager rooms={rooms} />
      )}
    </div>
  );
}
