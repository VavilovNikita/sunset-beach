import { notFound } from "next/navigation";
import { backendJson } from "@/lib/backendServer";
import { BackendError } from "@/lib/backend";
import { requireRoleAtLeast } from "@/lib/rbac";
import GuestCard from "@/components/admin/GuestCard";
import type { GuestDetail } from "@/lib/types";

export default async function AdminGuestDetailPage({ params }: { params: { id: string } }) {
  // GET /guests/{id} is CASHIER+ on the backend — guard the whole page rather than let a WAITER's
  // fetch below throw an uncaught 403.
  await requireRoleAtLeast("CASHIER", "/admin/pos");

  let guest: GuestDetail;
  try {
    guest = await backendJson<GuestDetail>(`/guests/${params.id}`, { auth: true });
  } catch (e) {
    if (e instanceof BackendError && e.status === 404) notFound();
    throw e;
  }

  return (
    <div>
      <p className="eyebrow text-sea mb-2">Guest</p>
      <h1 className="font-display italic text-3xl mb-8">{guest.name}</h1>
      <GuestCard guest={guest} />
    </div>
  );
}
