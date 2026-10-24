"use client";

import { useState } from "react";

const CONTROL = "bg-ink2 border border-cream/20 rounded-lg px-3 py-2 text-sm";

// The two linked history filters. An Entity ID means nothing without its type (the server answers 400), so the ID
// box stays switched off, with the reason written under it, until a type is chosen.
export default function AuditEntityFilter({
  types,
  initialType,
  initialId,
}: {
  types: { value: string; label: string }[];
  initialType: string;
  initialId: string;
}) {
  const [type, setType] = useState(initialType);
  return (
    <>
      <div>
        <label className="eyebrow text-cream/60 block mb-1">Entity type</label>
        <select name="entityType" value={type} onChange={(e) => setType(e.target.value)} className={CONTROL}>
          <option value="">All</option>
          {types.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="eyebrow text-cream/60 block mb-1">Entity ID</label>
        <input
          type="text"
          name="entityId"
          defaultValue={type ? initialId : ""}
          disabled={!type}
          placeholder={type ? "paste the record's ID" : "choose an entity type first"}
          aria-describedby="entity-id-hint"
          className={`${CONTROL} disabled:opacity-50`}
        />
        <p id="entity-id-hint" className="text-xs text-cream/40 mt-1 max-w-[16rem]">
          {type ? "Shows that one record's history." : "Pick an entity type to look up one record by its ID."}
        </p>
      </div>
    </>
  );
}
