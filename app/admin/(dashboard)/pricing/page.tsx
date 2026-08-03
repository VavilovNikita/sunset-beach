import { backendJson } from "@/lib/backendServer";
import PricingManager from "@/components/admin/PricingManager";
import type { Room } from "@/lib/types";

export default async function AdminPricingPage() {
  const rooms = await backendJson<Room[]>("/rooms", { auth: true });

  return (
    <div>
      <p className="eyebrow text-sea mb-2">Rates</p>
      <h1 className="font-display italic text-3xl mb-8">Pricing</h1>

      {rooms.length === 0 ? (
        <p className="text-cream/50 text-sm">Add a room first.</p>
      ) : (
        <PricingManager rooms={rooms.map((r) => ({ id: r.id, name: r.name }))} />
      )}
    </div>
  );
}
