"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type RoomFormValues = {
  name: string;
  description: string;
  capacity: number;
  basePrice: number;
};

export default function RoomForm({
  mode,
  roomId,
  initialValues,
}: {
  mode: "create" | "edit";
  roomId?: string;
  initialValues?: RoomFormValues;
}) {
  const router = useRouter();
  const [values, setValues] = useState<RoomFormValues>(
    initialValues ?? { name: "", description: "", capacity: 2, basePrice: 3000 }
  );
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const url = mode === "create" ? "/api/rooms" : `/api/rooms/${roomId}`;
    const method = mode === "create" ? "POST" : "PATCH";

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });

    setSubmitting(false);

    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setError(data?.error ? JSON.stringify(data.error) : "Something went wrong.");
      return;
    }

    if (mode === "create") {
      const created = await res.json();
      router.push(`/admin/rooms/${created.id}/edit`);
    } else {
      router.push("/admin/rooms");
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
          rows={4}
          value={values.description}
          onChange={(e) => setValues((v) => ({ ...v, description: e.target.value }))}
          className="w-full bg-transparent border-b border-cream/25 py-2 text-cream focus:outline-none focus:border-coral resize-none"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="eyebrow text-cream/60 block mb-1">Capacity (guests)</label>
          <input
            type="number"
            min={1}
            max={20}
            required
            value={values.capacity}
            onChange={(e) => setValues((v) => ({ ...v, capacity: Number(e.target.value) }))}
            className="w-full bg-transparent border-b border-cream/25 py-2 text-cream focus:outline-none focus:border-coral"
          />
        </div>
        <div>
          <label className="eyebrow text-cream/60 block mb-1">Base price / night (฿)</label>
          <input
            type="number"
            min={0}
            step="1"
            required
            value={values.basePrice}
            onChange={(e) => setValues((v) => ({ ...v, basePrice: Number(e.target.value) }))}
            className="w-full bg-transparent border-b border-cream/25 py-2 text-cream focus:outline-none focus:border-coral"
          />
        </div>
      </div>

      {error && <p className="text-sm text-coral">{error}</p>}

      <button
        type="submit"
        disabled={submitting}
        className="rounded-full bg-coral hover:bg-coraldeep transition-colors px-6 py-2.5 text-sm font-medium disabled:opacity-60"
      >
        {submitting ? "Saving…" : mode === "create" ? "Create room" : "Save changes"}
      </button>
    </form>
  );
}
