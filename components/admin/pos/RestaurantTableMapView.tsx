"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { draftOrderHref } from "@/lib/posDraftOrder";
import { getRestaurantMap, uploadRestaurantMapImage } from "@/lib/restaurantMapClient";
import {
  resolveRestaurantTableAction,
  resolveRestaurantTableFill,
  restaurantTableStateLabel,
} from "@/lib/restaurantMapDisplay";
import { usePolling } from "@/lib/usePolling";
import TableFloorPlan, { type FloorPlanTable } from "@/components/admin/TableFloorPlan";
import type { RestaurantMap, RestaurantMapTable } from "@/lib/posTypes";

// The restaurant floor plan - the spa map's mechanism a third time (TableFloorPlan does the
// placing/drag/upload), with the POS board's own meaning: busy = has an OPEN/SENT order, and
// opening a table does exactly what tapping it on OrderBoard does (open its order, ask which of
// several, or start a new one) - see resolveRestaurantTableAction.

// Same 5s cadence as OrderBoard/PosTableBoard - the same kind of live floor surface.
const POLL_INTERVAL_MS = 5000;

export default function RestaurantTableMapView({ initialMap, canManage }: { initialMap: RestaurantMap; canManage: boolean }) {
  const router = useRouter();

  const [map, setMap] = useState(initialMap);
  const [isEditing, setIsEditing] = useState(false);
  const [pickerTable, setPickerTable] = useState<RestaurantMapTable | null>(null);
  const [startingTableId, setStartingTableId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Same mid-edit guard as SpaTableMapView: a refresh (poll or router.refresh) that lands while a
  // drag is live or positions are unsaved is dropped whole, not merged into the edit.
  const isEditingRef = useRef(false);

  useEffect(() => {
    applyIfSafe(initialMap);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialMap]);

  function applyIfSafe(next: RestaurantMap) {
    if (isEditingRef.current) return;
    setMap(next);
  }

  async function refetch() {
    const result = await getRestaurantMap();
    if (!result.ok) {
      setLoadError(result.error);
      return;
    }
    setLoadError(null);
    applyIfSafe(result.map);
  }

  usePolling(refetch, POLL_INTERVAL_MS, !isEditing);

  async function handleOpenTable(tableId: string) {
    const table = map.tables.find((t) => t.tableId === tableId);
    if (!table || startingTableId) return;
    setActionError(null);
    const action = resolveRestaurantTableAction(table);
    if (action.kind === "open") {
      router.push(`/admin/pos/orders/${action.orderId}`);
    } else if (action.kind === "pick") {
      setPickerTable(table);
    } else if (action.kind === "start") {
      // No order is created here: the ticket opens as a draft and the order comes into existence
      // with its first item (lib/posDraftOrder.ts), so opening a free table and backing out leaves
      // the table free and nothing in the order history.
      setStartingTableId(tableId);
      router.push(draftOrderHref("/admin/pos/orders", { tableId }));
    } else {
      setActionError(`${table.label} is deactivated — a new order can't be started on it.`);
    }
  }

  const floorPlanTables: FloorPlanTable[] = map.tables.map((t) => ({
    tableId: t.tableId,
    label: t.label,
    positionX: t.positionX,
    positionY: t.positionY,
    fill: resolveRestaurantTableFill(t),
    stateLabel: startingTableId === t.tableId ? "Starting an order…" : restaurantTableStateLabel(t),
    shape: t.shape,
    capacity: t.capacity,
  }));

  return (
    <>
      {loadError && (
        <p className="text-sm text-coral bg-coral/10 border border-coral/30 rounded-xl px-4 py-3 mb-4">
          {loadError} Showing the last loaded state.
        </p>
      )}
      {actionError && <p className="text-sm text-coral mb-3">{actionError}</p>}
      {startingTableId && <p className="text-sm text-cream/50 mb-3">Starting an order…</p>}

      <TableFloorPlan
        tables={floorPlanTables}
        imageSrc={map.imagePath ? `/api/admin-proxy/restaurant-map/image?v=${encodeURIComponent(map.imageUpdatedAt ?? "")}` : null}
        imageAlt="Restaurant floor plan"
        canManage={canManage}
        pollIntervalMs={POLL_INTERVAL_MS}
        emptyTablesText="No restaurant tables yet — add them on the POS screen."
        onUpload={async (file) => {
          const result = await uploadRestaurantMapImage(file);
          if (!result.ok) return { ok: false, error: result.error };
          router.refresh();
          return { ok: true };
        }}
        onOpenTable={handleOpenTable}
        onEditingChange={(editing) => {
          isEditingRef.current = editing;
          setIsEditing(editing);
        }}
        onLayoutSaved={() => router.refresh()}
      />

      {pickerTable && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-ink/60 px-4" onClick={() => setPickerTable(null)}>
          <div className="w-full max-w-sm bg-ink2 border border-cream/15 rounded-xl p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <p className="eyebrow text-sea mb-1">Table {pickerTable.label}</p>
            <p className="text-sm text-cream/60 mb-4">This table has {pickerTable.openOrderIds.length} open orders. Which one?</p>
            <div className="space-y-2">
              {pickerTable.openOrderIds.map((orderId, i) => (
                <Link
                  key={orderId}
                  href={`/admin/pos/orders/${orderId}`}
                  className="block rounded-lg border border-cream/15 px-4 py-2.5 text-sm hover:border-cream/40 transition-colors"
                >
                  Order {i + 1}
                </Link>
              ))}
            </div>
            <button type="button" onClick={() => setPickerTable(null)} className="mt-4 text-sm text-cream/60 hover:text-cream transition-colors">
              Cancel
            </button>
          </div>
        </div>
      )}
    </>
  );
}
