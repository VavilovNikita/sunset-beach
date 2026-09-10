"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ADMIN_API_URL } from "@/lib/backend";
import { extractApiError } from "@/lib/apiError";

// A treatment-only fork of components/admin/pos/MenuItemForm.tsx, for the spa's own management
// screen (see /admin/spa/treatments) - same name/description/category/price/isAvailable fields,
// same full-replacement PATCH, same raw-fetch pattern that form already uses. What's different,
// deliberately: department is fixed to SPA (never shown as a choice - a treatment never routes
// to a kitchen/bar ticket, see MenuDepartment's own description), and durationMinutes is always
// shown and required, not conditional on a department selection that doesn't exist here.
type TreatmentFormValues = {
  name: string;
  description: string;
  category: string;
  price: number;
  isAvailable: boolean;
  durationMinutes: number;
};

export default function TreatmentForm({
  mode,
  itemId,
  initialValues,
}: {
  mode: "create" | "edit";
  itemId?: string;
  initialValues?: TreatmentFormValues;
}) {
  const router = useRouter();
  const [values, setValues] = useState<TreatmentFormValues>(
    initialValues ?? { name: "", description: "", category: "Treatments", price: 1000, isAvailable: true, durationMinutes: 60 }
  );
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const url = mode === "create" ? `${ADMIN_API_URL}/menu` : `${ADMIN_API_URL}/menu/${itemId}`;
    const method = mode === "create" ? "POST" : "PATCH";
    const body = { ...values, department: "SPA" as const };

    const res = await fetch(url, {
      method,
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    setSubmitting(false);

    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setError(extractApiError(data, "Something went wrong."));
      return;
    }

    if (mode === "create") {
      const created = await res.json();
      router.push(`/admin/spa/treatments/${created.id}/edit`);
    } else {
      router.push("/admin/spa/treatments");
    }
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-w-xl">
      <div>
        <label className="eyebrow text-cream/60 block mb-1">Name</label>
        <input
          type="text"
          required
          value={values.name}
          onChange={(e) => setValues((v) => ({ ...v, name: e.target.value }))}
          className="w-full bg-transparent border-b border-cream/25 py-2 text-cream focus:outline-none focus:border-coral"
        />
      </div>

      <div>
        <label className="eyebrow text-cream/60 block mb-1">Description</label>
        <textarea
          required
          rows={3}
          value={values.description}
          onChange={(e) => setValues((v) => ({ ...v, description: e.target.value }))}
          className="w-full bg-transparent border-b border-cream/25 py-2 text-cream focus:outline-none focus:border-coral resize-none"
        />
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label className="eyebrow text-cream/60 block mb-1">Category</label>
          <input
            type="text"
            required
            value={values.category}
            onChange={(e) => setValues((v) => ({ ...v, category: e.target.value }))}
            placeholder="e.g. Massages, Facials"
            className="w-full bg-transparent border-b border-cream/25 py-2 text-cream placeholder:text-cream/40 focus:outline-none focus:border-coral"
          />
          <p className="text-xs text-cream/40 mt-1">How this treatment is grouped on the menu display.</p>
        </div>
        <div>
          <label className="eyebrow text-cream/60 block mb-1">Duration (minutes)</label>
          <input
            type="number"
            min={1}
            step="1"
            required
            value={values.durationMinutes}
            onChange={(e) => setValues((v) => ({ ...v, durationMinutes: Number(e.target.value) }))}
            className="w-full bg-transparent border-b border-cream/25 py-2 text-cream focus:outline-none focus:border-coral"
          />
          <p className="text-xs text-cream/40 mt-1">
            Copied onto each new appointment when it&rsquo;s booked - changing this later never resizes an appointment already on the grid.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 items-end">
        <div>
          <label className="eyebrow text-cream/60 block mb-1">Price (฿)</label>
          <input
            type="number"
            min={0}
            step="1"
            required
            value={values.price}
            onChange={(e) => setValues((v) => ({ ...v, price: Number(e.target.value) }))}
            className="w-full bg-transparent border-b border-cream/25 py-2 text-cream focus:outline-none focus:border-coral"
          />
        </div>
        <label className="flex items-center gap-2 text-sm text-cream/70 pb-2">
          <input
            type="checkbox"
            checked={values.isAvailable}
            onChange={(e) => setValues((v) => ({ ...v, isAvailable: e.target.checked }))}
            className="accent-coral"
          />
          Available
        </label>
      </div>

      {error && <p className="text-sm text-coral">{error}</p>}

      <button
        type="submit"
        disabled={submitting}
        className="rounded-full bg-coral hover:bg-coraldeep transition-colors px-6 py-2.5 text-sm font-medium disabled:opacity-60"
      >
        {submitting ? "Saving…" : mode === "create" ? "Create treatment" : "Save changes"}
      </button>
    </form>
  );
}
