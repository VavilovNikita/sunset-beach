"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { saveTablePositions } from "@/lib/tablePositionsClient";
import { uploadSpaMapImage } from "@/lib/spaMapClient";
import type { Table, TablePositionInput } from "@/lib/posTypes";

// Pointer-drag mechanics are a direct copy of PropertyMapView.tsx's own approach (native Pointer
// Events, pointer capture on the tile the drag started from, touchAction disabled on the
// container only while dragging, Escape cancels, a click-vs-drag threshold so a plain tap opens
// nothing rather than "moving" a tile by zero pixels) - reusing the pattern, not reinventing a
// second way to place something on a floor plan. What's simpler here, deliberately: no fill/badge
// status logic (a table has no occupancy/dirty/debt state the way a room does - it's just a
// place, colored one way), and no click-to-open detail panel (nothing to show beyond the label
// already on the tile). The upload form below mirrors PropertyMapView's own
// PropertyMapUploadForm - this screen now owns its own image (GET/POST /spa-map/image), the
// same way the property map screen owns its.
const CLICK_THRESHOLD_PX = 6;

type PendingPosition = { positionX: number | null; positionY: number | null };

type DragState = {
  tableId: string;
  imgRect: DOMRect;
  startX: number;
  startY: number;
  x: number;
  y: number;
};

export default function SpaTableMapView({
  imagePath,
  imageUpdatedAt,
  tables,
}: {
  imagePath: string | null;
  imageUpdatedAt: string | null;
  tables: Table[];
}) {
  const router = useRouter();

  const [pending, setPending] = useState<Record<string, PendingPosition>>({});
  const [drag, setDrag] = useState<DragState | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const imageWrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!drag) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setDrag(null);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [drag]);

  function effectivePosition(table: Table): PendingPosition {
    return pending[table.id] ?? { positionX: table.positionX, positionY: table.positionY };
  }

  const placedTables = tables.filter((t) => effectivePosition(t).positionX !== null);
  const unplacedTables = tables.filter((t) => effectivePosition(t).positionX === null);
  const pendingCount = Object.keys(pending).length;

  function onTilePointerDown(e: React.PointerEvent<HTMLButtonElement>, tableId: string) {
    if (!imagePath) return;
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
    if (moved < CLICK_THRESHOLD_PX) return; // a plain tap on a table pin does nothing - see class comment

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
    setPending({});
    router.refresh();
  }

  function handleCancelLayout() {
    setPending({});
    setSaveError(null);
  }

  async function handleUpload(file: File) {
    setUploading(true);
    setUploadError(null);
    const result = await uploadSpaMapImage(file);
    setUploading(false);
    if (!result.ok) {
      setUploadError(result.error);
      return;
    }
    router.refresh();
  }

  const draggedTable = drag ? tables.find((t) => t.id === drag.tableId) : null;

  return (
    <div ref={containerRef}>
      <SpaMapUploadForm hasImage={Boolean(imagePath)} uploading={uploading} error={uploadError} onUpload={handleUpload} />

      {!imagePath ? (
        <div className="mt-4 rounded-xl border border-dashed border-cream/20 p-10 text-center text-sm text-cream/50 min-w-[480px]">
          Upload a floor plan above to start placing tables.
        </div>
      ) : (
        <div className="flex flex-col lg:flex-row gap-6 mt-4">
          <div className="flex-1 min-w-0 overflow-x-auto pb-2">
            <div ref={imageWrapperRef} className="relative inline-block select-none">
              {/* eslint-disable-next-line @next/next/no-img-element -- authenticated, proxied image; next/image can't reach it */}
              <img
                src={`/api/admin-proxy/spa-map/image?v=${encodeURIComponent(imageUpdatedAt ?? "")}`}
                alt="Spa floor plan"
                className="block w-[960px] max-w-none rounded-xl border border-cream/10"
                draggable={false}
              />
              {placedTables.map((table) => {
                const pos = effectivePosition(table);
                const isDragging = drag?.tableId === table.id;
                return (
                  <TableTile
                    key={table.id}
                    table={table}
                    dragging={isDragging}
                    onPointerDown={onTilePointerDown}
                    onPointerMove={onDragPointerMove}
                    onPointerUp={onDragPointerUp}
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
              <p className="text-sm text-cream/40">{tables.length === 0 ? "No active SPA-zone tables yet." : "Every table is placed."}</p>
            ) : (
              <div className="flex flex-wrap lg:flex-col gap-2">
                {unplacedTables.map((table) => (
                  <TableTile
                    key={table.id}
                    table={table}
                    dragging={drag?.tableId === table.id}
                    tray
                    onPointerDown={onTilePointerDown}
                    onPointerMove={onDragPointerMove}
                    onPointerUp={onDragPointerUp}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {drag && draggedTable && (
        <div
          className="fixed z-50 pointer-events-none rounded-full w-11 h-11 flex items-center justify-center text-xs font-medium border-2 bg-ink2 text-cream border-cream/50 shadow-lg"
          style={{ left: drag.x, top: drag.y, transform: "translate(-50%, -50%)" }}
        >
          {draggedTable.label}
        </div>
      )}

      {pendingCount > 0 && (
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
  dragging,
  tray,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  style,
}: {
  table: Table;
  dragging: boolean;
  tray?: boolean;
  onPointerDown: (e: React.PointerEvent<HTMLButtonElement>, tableId: string) => void;
  onPointerMove: (e: React.PointerEvent<HTMLButtonElement>) => void;
  onPointerUp: (e: React.PointerEvent<HTMLButtonElement>) => void;
  style?: React.CSSProperties;
}) {
  if (tray) {
    return (
      <button
        type="button"
        data-table-id={table.id}
        onPointerDown={(e) => onPointerDown(e, table.id)}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        className={`rounded-lg px-3 py-2 text-sm border flex items-center gap-2 transition-opacity bg-sea/10 text-cream/80 border-sea/30 cursor-grab active:cursor-grabbing touch-none ${
          dragging ? "opacity-30" : ""
        }`}
      >
        {table.label}
      </button>
    );
  }

  return (
    <button
      type="button"
      data-table-id={table.id}
      onPointerDown={(e) => onPointerDown(e, table.id)}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      title={table.label}
      style={style}
      className={`rounded-full w-11 h-11 flex items-center justify-center text-xs font-medium border-2 shadow transition-opacity bg-sea/20 text-cream border-sea cursor-grab active:cursor-grabbing touch-none ${
        dragging ? "opacity-30" : ""
      }`}
    >
      {table.label}
    </button>
  );
}

// Mirrors PropertyMapView.tsx's own PropertyMapUploadForm exactly - same accepted types, same
// file-input styling, same uploading/error states.
function SpaMapUploadForm({
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
