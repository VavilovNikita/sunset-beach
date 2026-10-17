"use client";

import { BLOCK_FUNCTIONS, BLOCK_FUNCTION_LABELS } from "@/lib/notifications";
import type { BlockResponsibleFunction } from "@/lib/types";

// Who must close a room block. The notification centre tells whoever is on shift with this job when
// the block is made, on its last day and while its task stays open. Shared by both places a block
// is made (the room's Blocks panel and a maintenance task's Block room form).
export default function BlockFunctionSelect({
  id,
  value,
  onChange,
  disabled,
}: {
  id: string;
  value: BlockResponsibleFunction;
  onChange: (value: BlockResponsibleFunction) => void;
  disabled?: boolean;
}) {
  return (
    <div>
      <label className="eyebrow text-cream/60 block mb-1" htmlFor={id}>
        Who closes it
      </label>
      <select
        id={id}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value as BlockResponsibleFunction)}
        className="w-full min-h-[44px] bg-ink border-b border-cream/25 py-2 text-cream text-sm focus:outline-none focus:border-coral disabled:opacity-60"
      >
        {BLOCK_FUNCTIONS.map((fn) => (
          <option key={fn} value={fn}>
            {BLOCK_FUNCTION_LABELS[fn]}
          </option>
        ))}
      </select>
      <p className="text-xs text-cream/40 mt-1">Whoever is on shift with this job is told about the block.</p>
    </div>
  );
}
