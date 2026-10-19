"use client";

import { useState } from "react";
import { FieldError, INPUT } from "@/components/admin/notificationSettings/SettingsCard";
import type { NotificationStaffMember } from "@/lib/types";

// A checkbox list of active staff. Long enough in a real hotel to scroll, short enough to read.
export default function RecipientPicker({
  label,
  staff,
  selected,
  onToggle,
  error,
}: {
  label: string;
  staff: NotificationStaffMember[];
  selected: string[];
  onToggle: (userId: string) => void;
  error?: string;
}) {
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const shown = staff.filter((m) => !q || m.name.toLowerCase().includes(q) || selected.includes(m.userId));
  return (
    <fieldset>
      <legend className="eyebrow text-cream/60 mb-1">
        {label} <span className="text-cream/40">({selected.length} chosen)</span>
      </legend>
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Find by name"
        aria-label="Find by name"
        className={`${INPUT} w-full max-w-xs mb-2 placeholder:text-cream/30`}
      />
      <div className="max-h-48 overflow-y-auto rounded-lg border border-cream/10 divide-y divide-cream/10">
        {shown.length === 0 && <p className="px-3 py-2 text-sm text-cream/50">Nobody matches.</p>}
        {shown.map((m) => (
          <label key={m.userId} className="flex items-center gap-2 px-3 min-h-[44px] text-sm text-cream cursor-pointer">
            <input type="checkbox" checked={selected.includes(m.userId)} onChange={() => onToggle(m.userId)} className="accent-coral" />
            <span>{m.name}</span>
            {!m.telegramLinked && <span className="text-xs text-cream/40">no Telegram chat</span>}
          </label>
        ))}
      </div>
      <FieldError message={error} />
    </fieldset>
  );
}
