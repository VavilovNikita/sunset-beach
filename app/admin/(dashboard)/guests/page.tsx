import { backendJson } from "@/lib/backendServer";
import { requireRoleAtLeast } from "@/lib/rbac";
import GuestsListView from "@/components/admin/GuestsListView";
import type { Guest } from "@/lib/types";

export default async function AdminGuestsPage() {
  // GET /guests is CASHIER+ on the backend, same front-desk floor as GET /bookings.
  await requireRoleAtLeast("CASHIER", "/admin/pos");

  const guests = await backendJson<Guest[]>(`/guests`, { auth: true });

  return (
    <div>
      <div className="mb-8">
        <p className="eyebrow text-sea mb-2">Front desk</p>
        <h1 className="font-display italic text-3xl">Guests</h1>
      </div>
      <GuestsListView initialGuests={guests} />
    </div>
  );
}
