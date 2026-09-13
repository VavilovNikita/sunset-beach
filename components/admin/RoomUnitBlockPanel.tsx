"use client";

import { useState } from "react";
import Link from "next/link";
import { deleteRoomUnitBlock } from "@/lib/roomUnitBlockClient";
import type { RoomUnitBlock } from "@/lib/types";

// Side panel opened by double-clicking (or, on touch, single-tapping) a block segment on the
// booking calendar grid - same shell as BookingCardPanel.tsx/PropertyMapUnitPanel.tsx (no dimming
// backdrop, click-outside closes). Like PropertyMapUnitPanel, this doesn't refetch its own data:
// the grid already has the full block list from GET /bookings/calendar, so this just displays it
// and asks the parent to refresh (onSaved) once a block is removed.
//
// `blocks` is a list, not a single block: the grid merges overlapping/adjacent blocks on a unit
// into one visual bar (lib/calendarLayout.ts's mergeBlocksByUnit), so the segment that was
// clicked can be backed by more than one underlying RoomUnitBlock row. Showing all of them,
// rather than picking one, is the honest option - a merged bar quietly hiding a second reason
// would be worse than a panel with two cards.
export default function RoomUnitBlockPanel({
  roomUnitId,
  roomLabel,
  blocks,
  canManage,
  onClose,
  onSaved,
}: {
  roomUnitId: string;
  roomLabel: string;
  blocks: RoomUnitBlock[];
  // MANAGER+ - same gate POST/DELETE /room-units/{id}/blocks already require (SecurityConfig's
  // /room-units/** catch-all). A CASHIER still gets the panel, just without the remove button -
  // hidden, not disabled, so it never offers a control that would just come back as a 403.
  canManage: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  return (
    <div className="fixed inset-0 z-40 pointer-events-none">
      <div className="absolute inset-0 pointer-events-auto" onClick={onClose} />
      <div
        className="absolute top-0 right-0 bottom-0 w-full sm:w-[400px] bg-ink2 border-l border-cream/15 shadow-2xl pointer-events-auto overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-5 border-b border-cream/10 flex items-center justify-between sticky top-0 bg-ink2 z-10">
          <p className="eyebrow text-coral">Blocked — {roomLabel}</p>
          <button onClick={onClose} className="text-cream/50 hover:text-cream transition-colors text-xl leading-none">
            ×
          </button>
        </div>

        <div className="p-5 space-y-4">
          {blocks.map((block) => (
            <BlockCard key={block.id} roomUnitId={roomUnitId} block={block} canManage={canManage} onSaved={onSaved} />
          ))}
        </div>
      </div>
    </div>
  );
}

function BlockCard({
  roomUnitId,
  block,
  canManage,
  onSaved,
}: {
  roomUnitId: string;
  block: RoomUnitBlock;
  canManage: boolean;
  onSaved: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleRemove() {
    if (!window.confirm("Remove this block? The room becomes available for these dates again.")) return;
    setBusy(true);
    setError(null);
    const result = await deleteRoomUnitBlock(roomUnitId, block.id);
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    onSaved();
  }

  return (
    <div className="bg-ink border border-cream/10 rounded-xl p-4 space-y-2 text-sm">
      <p className="text-cream">{block.reason}</p>
      <p className="text-cream/50">
        {block.fromDate} → {block.toDate}
      </p>
      <p className="text-xs text-cream/40">
        Created {block.createdAt.slice(0, 19).replace("T", " ")} UTC
        {block.createdByEmail ? ` by ${block.createdByEmail}` : " — creator not tracked"}
      </p>

      {block.maintenanceTask && (
        <div className="bg-ink2/60 border border-cream/15 rounded-lg px-3 py-2">
          <p className="text-cream/70 font-medium text-xs">Maintenance task ({block.maintenanceTask.status})</p>
          <p className="text-cream/60 mt-1">{block.maintenanceTask.description}</p>
          <Link
            href="/admin/maintenance"
            className="inline-block mt-1 text-xs text-sea hover:text-coral transition-colors underline underline-offset-4"
          >
            Open in Maintenance
          </Link>
        </div>
      )}

      {error && <p className="text-xs text-coral">{error}</p>}

      {canManage && (
        <button
          type="button"
          onClick={handleRemove}
          disabled={busy}
          className="text-xs text-coral hover:text-coraldeep transition-colors underline underline-offset-4 disabled:opacity-60"
        >
          {busy ? "Removing…" : "Remove block"}
        </button>
      )}
    </div>
  );
}
