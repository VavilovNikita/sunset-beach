import { notFound } from "next/navigation";
import { backendJson } from "@/lib/backendServer";
import { BackendError } from "@/lib/backend";
import { requireRoleAtLeast } from "@/lib/rbac";
import TreatmentForm from "@/components/admin/spa/TreatmentForm";
import type { MenuItem } from "@/lib/posTypes";

export default async function EditTreatmentPage({ params }: { params: { id: string } }) {
  await requireRoleAtLeast("MANAGER", "/admin/spa/treatments");

  let item: MenuItem;
  try {
    item = await backendJson<MenuItem>(`/menu/${params.id}`, { auth: true });
  } catch (e) {
    if (e instanceof BackendError && e.status === 404) notFound();
    throw e;
  }
  // Landing here for a non-SPA item would be a stray link, not a real flow - the treatments list
  // only ever links to SPA-department items, but a direct URL visit isn't validated server-side
  // otherwise. Same "not found" as a missing item, rather than silently coercing department.
  if (item.department !== "SPA") notFound();

  return (
    <div>
      <p className="eyebrow text-sea mb-2">Spa</p>
      <h1 className="font-display italic text-3xl mb-8">{item.name}</h1>
      <TreatmentForm
        mode="edit"
        itemId={item.id}
        initialValues={{
          name: item.name,
          description: item.description,
          category: item.category,
          price: Number(item.price),
          isAvailable: item.isAvailable,
          durationMinutes: item.durationMinutes ?? 60,
        }}
      />
    </div>
  );
}
