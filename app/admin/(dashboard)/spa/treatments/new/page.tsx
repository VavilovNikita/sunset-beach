import TreatmentForm from "@/components/admin/spa/TreatmentForm";
import SubpageBackLink from "@/components/admin/SubpageBackLink";
import { requireRoleAtLeast } from "@/lib/rbac";

export default async function NewTreatmentPage() {
  await requireRoleAtLeast("MANAGER", "/admin/spa/treatments");

  return (
    <div>
      <SubpageBackLink href="/admin/spa/treatments" label="Treatments" />
      <p className="eyebrow text-sea mb-2">Spa</p>
      <h1 className="font-display italic text-3xl mb-8">New treatment</h1>
      <TreatmentForm mode="create" />
    </div>
  );
}
