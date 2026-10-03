"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { getSpaMap, uploadSpaMapImage } from "@/lib/spaMapClient";
import { usePolling } from "@/lib/usePolling";
import { resolveSpaTableFill } from "@/lib/spaMapDisplay";
import SpaTableMapPanel from "@/components/admin/SpaTableMapPanel";
import TableFloorPlan, { type FloorPlanTable } from "@/components/admin/TableFloorPlan";
import type { SpaMap, SpaMapTable } from "@/lib/posTypes";

// The spa's floor plan. Placement, drag and upload live in TableFloorPlan (shared with the
// restaurant map); this component owns what's spa-specific - the live poll of GET /spa-map, what
// a tile's fill and tooltip say, and the read-only panel a tile opens.

// The map shows busy/free state that's true only as of the moment it was read - a page nobody
// ever refreshes would show "free" from hours ago to whoever opens it in the morning. Polls at
// the same 5s cadence PosTableBoard/OrderBoard already use for a live floor board - this screen
// is the same kind of surface (many tables, glanced at repeatedly through a shift), not the
// tighter 3s an actively-open single order needs or the looser 10-20s a background badge can get
// away with.
const POLL_INTERVAL_MS = 5000;

function stateLabelFor(table: SpaMapTable): string {
  if (!table.isActive) return "Inactive";
  if (table.busy) return "Busy";
  return table.nextAppointmentStartTime ? `Free — next ${table.nextAppointmentStartTime}` : "Free";
}

export default function SpaTableMapView({ initialMap, canManage }: { initialMap: SpaMap; canManage: boolean }) {
  const router = useRouter();

  const [spaMap, setSpaMap] = useState(initialMap);
  const [selectedTableId, setSelectedTableId] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);

  // Read at apply-time, not capture-time: a poll already in flight when a drag/pending edit
  // starts must not land once it resolves - see applyIfSafe below for what happens to it instead.
  const isEditingRef = useRef(false);

  // Mirrors PosTableBoard's own initialX-prop-changed sync (router.refresh() after a save/upload
  // re-fetches this page's server data, which flows back in as a new initialMap) - applyIfSafe
  // below is the one gate both this and the poll must pass, so a refresh landing mid-edit from
  // *either* source is dropped the same way.
  useEffect(() => {
    applyIfSafe(initialMap);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialMap]);

  function applyIfSafe(map: SpaMap) {
    // Don't move the ground under a manager mid-placement: a refresh that would land while a drag
    // is live or positions are unsaved is dropped whole, not merged - the next successful poll
    // (or the save/cancel that clears pending) is what catches the screen up, never a partial
    // update layered on top of an edit in progress.
    if (isEditingRef.current) return;
    setSpaMap(map);
  }

  async function refetch() {
    const result = await getSpaMap();
    if (result.ok) applyIfSafe(result.map);
  }

  // Paused (not just a dropped-on-arrival response) while editing, so a manager mid-drag isn't
  // burning a request every 5s for a response that's guaranteed to be discarded - usePolling
  // itself also only ever fires while the tab is actually visible.
  usePolling(refetch, POLL_INTERVAL_MS, !isEditing);

  const { imagePath, imageUpdatedAt, tables } = spaMap;
  const floorPlanTables: FloorPlanTable[] = tables.map((t) => ({
    tableId: t.tableId,
    label: t.label,
    positionX: t.positionX,
    positionY: t.positionY,
    fill: resolveSpaTableFill(t),
    stateLabel: stateLabelFor(t),
    shape: t.shape,
    capacity: t.capacity,
  }));
  const selectedTable = tables.find((t) => t.tableId === selectedTableId) ?? null;

  return (
    <>
      <TableFloorPlan
        tables={floorPlanTables}
        imageSrc={imagePath ? `/api/admin-proxy/spa-map/image?v=${encodeURIComponent(imageUpdatedAt ?? "")}` : null}
        imageAlt="Spa floor plan"
        canManage={canManage}
        pollIntervalMs={POLL_INTERVAL_MS}
        emptyTablesText="No active SPA-zone tables yet."
        onUpload={async (file) => {
          const result = await uploadSpaMapImage(file);
          if (!result.ok) return { ok: false, error: result.error };
          router.refresh();
          return { ok: true };
        }}
        onOpenTable={setSelectedTableId}
        onEditingChange={(editing) => {
          isEditingRef.current = editing;
          setIsEditing(editing);
        }}
        onLayoutSaved={() => router.refresh()}
      />
      {selectedTable && <SpaTableMapPanel table={selectedTable} onClose={() => setSelectedTableId(null)} />}
    </>
  );
}
