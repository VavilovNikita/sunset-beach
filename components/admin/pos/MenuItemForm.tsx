"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createMenuItem, updateMenuItem } from "@/lib/menuItemClient";
import { MENU_DEPARTMENT_LABELS } from "@/lib/posOrders";
import type { MenuDepartment } from "@/lib/posTypes";

// SPA is deliberately not offered here - treatments have their own management screen
// (/admin/spa/treatments, TreatmentForm.tsx) with department fixed to SPA and no
// kitchen/bar-routing choice at all. This form stays food/drink-only, same as the menu list
// it backs (see app/admin/(dashboard)/pos/menu/page.tsx's own SPA filter).
const DEPARTMENTS: Exclude<MenuDepartment, "SPA">[] = ["KITCHEN", "BAR"];

type MenuItemFormValues = {
  name: string;
  description: string;
  category: string;
  department: Exclude<MenuDepartment, "SPA">;
  price: number;
  isAvailable: boolean;
};

export default function MenuItemForm({
  mode,
  itemId,
  initialValues,
}: {
  mode: "create" | "edit";
  itemId?: string;
  initialValues?: MenuItemFormValues;
}) {
  const router = useRouter();
  const [values, setValues] = useState<MenuItemFormValues>(
    initialValues ?? { name: "", description: "", category: "", department: "KITCHEN", price: 100, isAvailable: true }
  );
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    // durationMinutes only ever means anything for a SPA item, which this form never handles -
    // always explicit null, same full-replacement contract as every other field here.
    const body = { ...values, durationMinutes: null };
    const result = mode === "create" ? await createMenuItem(body) : await updateMenuItem(itemId!, body);

    setSubmitting(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    if (mode === "create") {
      router.push(`/admin/pos/menu/${result.item.id}/edit`);
    } else {
      router.push("/admin/pos/menu");
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
            placeholder="e.g. Mains, Drinks"
            className="w-full bg-transparent border-b border-cream/25 py-2 text-cream placeholder:text-cream/40 focus:outline-none focus:border-coral"
          />
          <p className="text-xs text-cream/40 mt-1">How this item is grouped on the menu display. Doesn&rsquo;t affect printing.</p>
        </div>
        <div>
          <label className="eyebrow text-cream/60 block mb-1">Department</label>
          <select
            value={values.department}
            onChange={(e) => setValues((v) => ({ ...v, department: e.target.value as Exclude<MenuDepartment, "SPA"> }))}
            className="w-full bg-ink2 border-b border-cream/25 py-2 text-cream text-sm focus:outline-none focus:border-coral"
          >
            {DEPARTMENTS.map((d) => (
              <option key={d} value={d}>
                {MENU_DEPARTMENT_LABELS[d]}
              </option>
            ))}
          </select>
          <p className="text-xs text-cream/40 mt-1">Which printer this item&rsquo;s ticket is sent to when the order is sent.</p>
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
        {submitting ? "Saving…" : mode === "create" ? "Create item" : "Save changes"}
      </button>
    </form>
  );
}
