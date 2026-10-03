"use client";

import { useEffect, useRef, useState } from "react";
import { saveTablePositions } from "@/lib/tablePositionsClient";
import { useTapOrDoubleClick } from "@/lib/useTapOrDoubleClick";
import { useSavedNotice } from "@/lib/useSavedNotice";
import type { TablePositionInput, TableShape } from "@/lib/posTypes";

// The table-placement floor plan shared by the spa map (SpaTableMapView) and the restaurant map
// (RestaurantTableMapView) - background image, placed tiles, the "not on the map" tray, drag to
// place, save/cancel the layout, upload/replace the image. Extracted from SpaTableMapView when
// the restaurant became its second user, so both screens run one copy of the drag logic rather
// than two that drift. What a tile *means* (its fill, its label, what opening it does) stays with
// each caller; this component only knows where tiles are.
//
// Pointer-drag mechanics are a direct copy of PropertyMapView.tsx's own approach (native Pointer
// Events, pointer capture on the tile the drag started from, touchAction disabled on the
// container only while dragging, Escape cancels a drag), gated on canManage - placing tables is
// MANAGER+ (PATCH /tables/positions), viewing is not.
//
// Opening a tile is a separate gesture from the drag, and deliberately not the property map's
// own click-threshold trick: a manager's tile is both draggable and openable, and requiring a
// double-click (mouse) / single tap (touch) to open - lib/useTapOrDoubleClick.ts - means a single
// click can still be the start of a drag without also opening anything. A viewer without
// canManage has no drag at all, so their tile only ever gets the open gesture.
const CLICK_THRESHOLD_PX = 6;

export type FloorPlanFill = "inactive" | "busy" | "free";

export type FloorPlanTable = {
  tableId: string;
  label: string;
  positionX: number | null;
  positionY: number | null;
  fill: FloorPlanFill;
  // Shown as the tile's tooltip after its label - "Busy", "Free — next 14:00", ...
  stateLabel: string;
  // Drawn on the plan: the tile's outline follows the shape, and the seat count sits under the label.
  shape: TableShape;
  capacity: number;
};

// Tile outline per shape. Sized in px, not in % of the image: a tile must stay tappable however
// far the plan is scaled down to fit a narrow screen.
const SHAPE_CLASS: Record<TableShape, string> = {
  ROUND: "rounded-full w-12 h-12",
  SQUARE: "rounded-md w-12 h-12",
  RECTANGLE: "rounded-md w-[4.5rem] h-11",
};

type PendingPosition = { positionX: number | null; positionY: number | null };

type DragState = {
  tableId: string;
  imgRect: DOMRect;
  startX: number;
  startY: number;
  x: number;
  y: number;
};

const FILL_CLASS: Record<FloorPlanFill, string> = {
  inactive: "bg-cream/10 text-cream/40 border-cream/15",
  busy: "bg-ink2 text-cream border-cream/30",
  free: "bg-sea text-ink border-sea",
};

export type UploadResult = { ok: true } | { ok: false; error: string };

export default function TableFloorPlan({
  tables,
  imageSrc,
  imageAlt,
  canManage,
  pollIntervalMs,
  emptyTablesText,
  onUpload,
  onOpenTable,
  onEditingChange,
  onLayoutSaved,
}: {
  tables: FloorPlanTable[];
  // Null until a manager uploads a plan.
  imageSrc: string | null;
  imageAlt: string;
  canManage: boolean;
  pollIntervalMs: number;
  emptyTablesText: string;
  onUpload: (file: File) => Promise<UploadResult>;
  onOpenTable: (tableId: string) => void;
  // The caller owns the poll, and must not move the ground under a manager mid-placement - see
  // SpaTableMapView's applyIfSafe.
  onEditingChange: (editing: boolean) => void;
  onLayoutSaved: () => void;
}) {
  const [pending, setPending] = useState<Record<string, PendingPosition>>({});
  const [drag, setDrag] = useState<DragState | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  // "Layout saved." after Save layout - the save bar itself disappears with the pending changes,
  // so without this nothing on screen said whether the save went through.
  const [savedNotice, showSavedNotice] = useSavedNotice();

  const containerRef = useRef<HTMLDivElement>(null);
  const imageWrapperRef = useRef<HTMLDivElement>(null);
  const { note: notePointerType, bind: bindTapOrDoubleClick } = useTapOrDoubleClick();

  const pendingCount = Object.keys(pending).length;
  const isEditing = drag !== null || pendingCount > 0;

  useEffect(() => {
    onEditingChange(isEditing);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEditing]);

  useEffect(() => {
    if (!drag) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setDrag(null);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [drag]);

  function effectivePosition(table: FloorPlanTable): PendingPosition {
    return pending[table.tableId] ?? { positionX: table.positionX, positionY: table.positionY };
  }

  const placedTables = tables.filter((t) => effectivePosition(t).positionX !== null);
  const unplacedTables = tables.filter((t) => effectivePosition(t).positionX === null);

  function onTilePointerDown(e: React.PointerEvent<HTMLButtonElement>, tableId: string) {
    notePointerType(e);
    if (!canManage || !imageSrc) return;
    const imgRect = imageWrapperRef.current?.getBoundingClientRect();
    if (!imgRect) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    if (containerRef.current) containerRef.current.style.touchAction = "none";
    setDrag({ tableId, imgRect, startX: e.clientX, startY: e.clientY, x: e.clientX, y: e.clientY });
  }

  function onDragPointerMove(e: React.PointerEvent<HTMLButtonElement>) {
    if (!drag || drag.tableId !== e.currentTarget.dataset.tableId) return;
    setDrag((prev) => (prev ? { ...prev, x: e.clientX, y: e.clientY } : prev));
  }

  function onDragPointerUp(e: React.PointerEvent<HTMLButtonElement>) {
    if (!drag) return;
    if (containerRef.current) containerRef.current.style.touchAction = "";
    const finished = drag;
    setDrag(null);

    const moved = Math.hypot(e.clientX - finished.startX, e.clientY - finished.startY);
    if (moved < CLICK_THRESHOLD_PX) return; // a plain click here is the open gesture's job, not this one's

    const { imgRect } = finished;
    const withinX = e.clientX >= imgRect.left && e.clientX <= imgRect.right;
    const withinY = e.clientY >= imgRect.top && e.clientY <= imgRect.bottom;
    if (withinX && withinY) {
      const positionX = round4(clamp01((e.clientX - imgRect.left) / imgRect.width));
      const positionY = round4(clamp01((e.clientY - imgRect.top) / imgRect.height));
      setPending((prev) => ({ ...prev, [finished.tableId]: { positionX, positionY } }));
    } else {
      setPending((prev) => ({ ...prev, [finished.tableId]: { positionX: null, positionY: null } }));
    }
  }

  async function handleSaveLayout() {
    setSaving(true);
    setSaveError(null);
    const items: TablePositionInput[] = Object.entries(pending).map(([tableId, pos]) => ({ tableId, ...pos }));
    const result = await saveTablePositions(items);
    setSaving(false);
    if (!result.ok) {
      setSaveError(result.error);
      return;
    }
    const count = items.length;
    setPending({});
    showSavedNotice(`Layout saved — ${count} table${count === 1 ? "" : "s"} updated.`);
    onLayoutSaved();
  }

  function handleCancelLayout() {
    setPending({});
    setSaveError(null);
  }

  async function handleUpload(file: File) {
    setUploading(true);
    setUploadError(null);
    const result = await onUpload(file);
    setUploading(false);
    if (!result.ok) setUploadError(result.error);
  }

  const draggedTable = drag ? tables.find((t) => t.tableId === drag.tableId) : null;

  return (
    <div ref={containerRef}>
      <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
        {canManage ? (
          <FloorPlanUploadForm hasImage={Boolean(imageSrc)} uploading={uploading} error={uploadError} onUpload={handleUpload} />
        ) : (
          <span />
        )}
        {/* Plainly says whether what's on screen is live or frozen - a paused board must never
            look the same as a live one. */}
        <span className="flex items-center gap-3 shrink-0">
          {savedNotice && (
            <span role="status" className="text-xs text-green-400">
              {savedNotice}
            </span>
          )}
          <span className={`text-xs ${isEditing ? "text-amber-400" : "text-cream/40"}`}>
            {isEditing ? "Paused — unsaved changes" : `Updates every ${pollIntervalMs / 1000}s`}
          </span>
        </span>
      </div>

      {!imageSrc ? (
        <div className="mt-4 rounded-xl border border-dashed border-cream/20 p-10 text-center text-sm text-cream/50">
          {canManage ? "Upload a floor plan above to start placing tables." : "No floor plan has been uploaded yet."}
        </div>
      ) : (
        <div className="flex flex-col lg:flex-row gap-6 mt-4">
          <div className="flex-1 min-w-0 pb-2">
            {/* The plan scales to the column's width (never wider than the image itself). Tiles are
                placed in % of the wrapper, so they stay on the same spot at any size; the drag
                reads the wrapper's rect at pointerdown, so it works at any scale too. */}
            <div ref={imageWrapperRef} className="relative block w-full max-w-[1200px] select-none">
              {/* eslint-disable-next-line @next/next/no-img-element -- authenticated, proxied image; next/image can't reach it */}
              <img src={imageSrc} alt={imageAlt} className="block w-full h-auto rounded-xl border border-cream/10" draggable={false} />
              {placedTables.map((table) => {
                const pos = effectivePosition(table);
                return (
                  <TableTile
                    key={table.tableId}
                    table={table}
                    canManage={canManage}
                    dragging={drag?.tableId === table.tableId}
                    onPointerDown={onTilePointerDown}
                    onPointerMove={onDragPointerMove}
                    onPointerUp={onDragPointerUp}
                    tapHandlers={bindTapOrDoubleClick(() => onOpenTable(table.tableId))}
                    style={{
                      position: "absolute",
                      left: `${(pos.positionX ?? 0) * 100}%`,
                      top: `${(pos.positionY ?? 0) * 100}%`,
                      transform: "translate(-50%, -50%)",
                    }}
                  />
                );
              })}
            </div>
          </div>

          <div className="w-full lg:w-60 shrink-0">
            <p className="eyebrow text-cream/50 mb-2">Not on the map{unplacedTables.length > 0 ? ` (${unplacedTables.length})` : ""}</p>
            {unplacedTables.length === 0 ? (
              <p className="text-sm text-cream/40">{tables.length === 0 ? emptyTablesText : "Every table is placed."}</p>
            ) : (
              <div className="flex flex-wrap lg:flex-col gap-2">
                {unplacedTables.map((table) => (
                  <TableTile
                    key={table.tableId}
                    table={table}
                    canManage={canManage}
                    dragging={drag?.tableId === table.tableId}
                    tray
                    onPointerDown={onTilePointerDown}
                    onPointerMove={onDragPointerMove}
                    onPointerUp={onDragPointerUp}
                    tapHandlers={bindTapOrDoubleClick(() => onOpenTable(table.tableId))}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {drag && draggedTable && (
        <div
          className={`fixed z-50 pointer-events-none ${SHAPE_CLASS[draggedTable.shape]} flex items-center justify-center text-xs font-medium border-2 bg-ink2 text-cream border-cream/50 shadow-lg`}
          style={{ left: drag.x, top: drag.y, transform: "translate(-50%, -50%)" }}
        >
          {draggedTable.label}
        </div>
      )}

      {canManage && pendingCount > 0 && (
        <div className="sticky bottom-4 mt-4 flex flex-wrap items-center gap-3 bg-ink2 border border-cream/20 rounded-xl px-4 py-3 shadow-2xl">
          <span className="text-sm text-cream/70">
            {pendingCount} table{pendingCount === 1 ? "" : "s"} moved
          </span>
          {saveError && <span className="text-sm text-coral">{saveError}</span>}
          <button type="button" onClick={handleCancelLayout} disabled={saving} className="text-sm text-cream/60 hover:text-cream transition-colors">
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSaveLayout}
            disabled={saving}
            className="ml-auto rounded-full bg-coral hover:bg-coraldeep transition-colors px-5 py-2 text-sm font-medium disabled:opacity-60"
          >
            {saving ? "Saving…" : "Save layout"}
          </button>
        </div>
      )}
    </div>
  );
}

function TableTile({
  table,
  canManage,
  dragging,
  tray,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  tapHandlers,
  style,
}: {
  table: FloorPlanTable;
  canManage: boolean;
  dragging: boolean;
  tray?: boolean;
  onPointerDown: (e: React.PointerEvent<HTMLButtonElement>, tableId: string) => void;
  onPointerMove: (e: React.PointerEvent<HTMLButtonElement>) => void;
  onPointerUp: (e: React.PointerEvent<HTMLButtonElement>) => void;
  tapHandlers: { onClick: () => void; onDoubleClick: () => void };
  style?: React.CSSProperties;
}) {
  const shape = tray
    ? "rounded-lg px-3 py-2 text-sm border flex items-center gap-2"
    : `${SHAPE_CLASS[table.shape]} flex flex-col items-center justify-center leading-tight text-xs font-medium border-2 shadow`;
  return (
    <button
      type="button"
      data-table-id={table.tableId}
      onPointerDown={(e) => onPointerDown(e, table.tableId)}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onClick={tapHandlers.onClick}
      onDoubleClick={tapHandlers.onDoubleClick}
      title={`${table.label} · ${table.capacity} seat${table.capacity === 1 ? "" : "s"} — ${table.stateLabel}`}
      style={style}
      className={`${shape} transition-opacity ${FILL_CLASS[table.fill]} ${
        canManage ? "cursor-grab active:cursor-grabbing touch-none" : "cursor-pointer"
      } ${dragging ? "opacity-30" : ""}`}
    >
      <span>{table.label}</span>
      <span className={tray ? "text-xs opacity-60" : "text-[0.6rem] font-normal opacity-70"}>{table.capacity}p</span>
    </button>
  );
}

// Mirrors PropertyMapView.tsx's own PropertyMapUploadForm exactly - same accepted types, same
// file-input styling, same uploading/error states.
function FloorPlanUploadForm({
  hasImage,
  uploading,
  error,
  onUpload,
}: {
  hasImage: boolean;
  uploading: boolean;
  error: string | null;
  onUpload: (file: File) => void;
}) {
  return (
    <div className="flex items-center gap-3 flex-wrap">
      <label className="text-sm">
        <span className="eyebrow text-cream/50 block mb-1">{hasImage ? "Replace floor plan" : "Upload floor plan"}</span>
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          disabled={uploading}
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (file) onUpload(file);
          }}
          className="block text-sm text-cream/60 file:mr-3 file:rounded-full file:border-0 file:bg-coral file:px-4 file:py-2 file:text-sm file:font-medium file:text-cream hover:file:bg-coraldeep file:transition-colors file:cursor-pointer disabled:opacity-60"
        />
      </label>
      {uploading && <span className="text-sm text-cream/50">Uploading…</span>}
      {error && <span className="text-sm text-coral">{error}</span>}
    </div>
  );
}

function clamp01(n: number) {
  return Math.min(1, Math.max(0, n));
}

function round4(n: number) {
  return Math.round(n * 10000) / 10000;
}
