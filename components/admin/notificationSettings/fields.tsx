"use client";

import { FieldError, INPUT } from "@/components/admin/notificationSettings/SettingsCard";

export function CheckField({ label, hint, checked, onChange, below }: { label: string; hint?: string; checked: boolean; onChange: (v: boolean) => void; below?: React.ReactNode }) {
  return (
    <div>
      <label className="flex items-center gap-2 text-sm text-cream min-h-[32px]">
        <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="accent-coral" />
        {label}
      </label>
      {hint && <p className="text-xs text-cream/40 ml-6">{hint}</p>}
      {below}
    </div>
  );
}

export function NumberField({
  label,
  unit,
  hint,
  value,
  onChange,
  error,
}: {
  label: string;
  unit?: string;
  hint?: string;
  value: string;
  onChange: (v: string) => void;
  error?: string;
}) {
  return (
    <div>
      <label className="flex flex-wrap items-center gap-3 text-sm text-cream">
        <input value={value} onChange={(e) => onChange(e.target.value)} inputMode="numeric" aria-invalid={error ? true : undefined} className={`${INPUT} w-24`} />
        {label}
        {unit ? ` (${unit})` : ""}
      </label>
      {hint && !error && <p className="text-xs text-cream/40 mt-1">{hint}</p>}
      <FieldError message={error} />
    </div>
  );
}

export function TimeField({ label, value, onChange, error }: { label: string; value: string; onChange: (v: string) => void; error?: string }) {
  return (
    <div>
      <label className="flex items-center gap-3 text-sm text-cream">
        <input type="time" value={value} onChange={(e) => onChange(e.target.value)} aria-invalid={error ? true : undefined} className={INPUT} />
        {label}
      </label>
      <FieldError message={error} />
    </div>
  );
}
