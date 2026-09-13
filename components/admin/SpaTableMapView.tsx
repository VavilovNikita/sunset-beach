"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { saveTablePositions } from "@/lib/tablePositionsClient";
import { getSpaMap, uploadSpaMapImage } from "@/lib/spaMapClient";
import { usePolling } from "@/lib/usePolling";
import { useTapOrDoubleClick } from "@/lib/useTapOrDoubleClick";
import { resolveSpaTableFill } from "@/lib/spaMapDisplay";
import SpaTableMapPanel from "@/components/admin/SpaTableMapPanel";
import type { SpaMap, SpaMapTable, TablePositionInput } from "@/lib/posTypes";

// Pointer-drag mechanics are a direct copy of PropertyMapView.tsx's own approach (native Pointer
// Events, pointer capture on the tile the drag started from, touchAction disabled on the
// container only while dragging, Escape cancels a drag), gated on canManage the same way that
// view gates its own drag on canManage - placing tables is MANAGER+, viewing is not (see this
// screen's own page for the role split and why).
//
// Opening the detail panel is a separate gesture from the drag, and deliberately not the property
// map's own click-threshold trick: a manager's tile is both draggable and openable, and requiring
// a double-click (mouse) / single tap (touch) to open - lib/useTapOrDoubleClick.ts, the same hook
// BookingCalendarGrid/SpaScheduleGrid already use - means a single click can still be the start of
// a drag without also opening the panel. A CASHIER viewer has no drag at all, so their tile only
// ever gets the open gesture.
const CLICK_THRESHOLD_PX = 6;

// The map shows busy/free state that's true only as of the moment it was read - a page nobody
// ever refreshes would show "free" from hours ago to whoever opens it in the morning. Polls at
// the same 5s cadence PosTableBoard/OrderBoard already use for a live floor board - this screen
// is the same kind of surface (many tables, glanced at repeatedly through a shift), not the
// tighter 3s an actively-open single order needs or the looser 10-20s a background badge can get
// away with.
const POLL_INTERVAL_MS = 5000;

type PendingPosition = { positionX: number | null; positionY: number | null };

type DragState = {
  tableId: string;
  imgRect: DOMRect;
  startX: number;
  startY: number;
  x: number;
  y: number;
};

const FILL_CLASS: Record<string, string> = {
  inactive: "bg-cream/10 text-cream/40 border-cream/15",
  busy: "bg-ink2 text-cream border-cream/30",
  free: "bg-sea text-ink border-sea",
};

export default function SpaTableMapView({ initialMap, canManage }: { initialMap: SpaMap; canManage: boolean }) {
  const router = useRouter();

  const [spaMap, setSpaMap] = useState(initialMap);
  const [pending, setPending] = useState<Record<string, PendingPosition>>({});
  const [drag, setDrag] = useState<DragState | null>(null);
  const [selectedTableId, setSelectedTableId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const { imagePath, imageUpdatedAt, tables } = spaMap;

  const containerRef = useRef<HTMLDivElement>(null);
  const imageWrapperRef = useRef<HTMLDivElement>(null);
  const { note: notePointerType, bind: bindTapOrDoubleClick } = useTapOrDoubleClick();

  const pendingCount = Object.keys(pending).length;
  const isEditing = drag !== null || pendingCount > 0;

  // Mirrors PosTableBoard's own initialX-prop-changed sync (router.refresh() after a save/upload
  // re-fetches this page's server data, which flows back in as a new initialMap) - refIsSafe below
  // is the one gate both this and the poll must pass, so a refresh landing mid-edit from *either*
  // source is dropped the same way.
  useEffect(() => {
    applyIfSafe(initialMap);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialMap]);

  // Read at apply-time, not capture-time: a poll already in flight when a drag/pending edit
  // starts must not land once it resolves - see applyIfSafe below for what happens to it instead.
  const isEditingRef = useRef(isEditing);
  isEditingRef.current = isEditing;

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

  useEffect(() => {
    if (!drag) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setDrag(null);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [drag]);

  function effectivePosition(table: SpaMapTable): PendingPosition {
    return pending[table.tableId] ?? { positionX: table.positionX, positionY: table.positionY };
  }

  const placedTables = tables.filter((t) => effectivePosition(t).positionX !== null);
  const unplacedTables = tables.filter((t) => effectivePosition(t).positionX === null);

  function onTilePointerDown(e: React.PointerEvent<HTMLButtonElement>, tableId: string) {
    notePointerType(e);
    if (!canManage || !imagePath) return;
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

  const draggedTable = drag ? tables.find((t) => t.tableId === drag.tableId) : null;
  const selectedTable = tables.find((t) => t.tableId === selectedTableId) ?? null;

  return (
    <div ref={containerRef}>
      <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
        {canManage ? (
          <SpaMapUploadForm hasImage={Boolean(imagePath)} uploading={uploading} error={uploadError} onUpload={handleUpload} />
        ) : (
          <span />
        )}
        {/* Plainly says whether what's on screen is live or frozen - the fallback this project's
            own rule requires ("never swallow a failure into a plausible-looking...state") applied
            to staleness, not just failure: a paused board must never look the same as a live one. */}
        <span className={`text-xs shrink-0 ${isEditing ? "text-amber-400" : "text-cream/40"}`}>
          {isEditing ? "Paused — unsaved changes" : `Updates every ${POLL_INTERVAL_MS / 1000}s`}
        </span>
      </div>

      {!imagePath ? (
        <div className="mt-4 rounded-xl border border-dashed border-cream/20 p-10 text-center text-sm text-cream/50 min-w-[480px]">
          {canManage ? "Upload a floor plan above to start placing tables." : "No floor plan has been uploaded yet."}
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
                const isDragging = drag?.tableId === table.tableId;
                return (
                  <TableTile
                    key={table.tableId}
                    table={table}
                    canManage={canManage}
                    dragging={isDragging}
                    onPointerDown={onTilePointerDown}
                    onPointerMove={onDragPointerMove}
                    onPointerUp={onDragPointerUp}
                    tapHandlers={bindTapOrDoubleClick(() => setSelectedTableId(table.tableId))}
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
                    key={table.tableId}
                    table={table}
                    canManage={canManage}
                    dragging={drag?.tableId === table.tableId}
                    tray
                    onPointerDown={onTilePointerDown}
                    onPointerMove={onDragPointerMove}
                    onPointerUp={onDragPointerUp}
                    tapHandlers={bindTapOrDoubleClick(() => setSelectedTableId(table.tableId))}
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

      {selectedTable && <SpaTableMapPanel table={selectedTable} onClose={() => setSelectedTableId(null)} />}
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
  table: SpaMapTable;
  canManage: boolean;
  dragging: boolean;
  tray?: boolean;
  onPointerDown: (e: React.PointerEvent<HTMLButtonElement>, tableId: string) => void;
  onPointerMove: (e: React.PointerEvent<HTMLButtonElement>) => void;
  onPointerUp: (e: React.PointerEvent<HTMLButtonElement>) => void;
  tapHandlers: { onClick: () => void; onDoubleClick: () => void };
  style?: React.CSSProperties;
}) {
  const fill = resolveSpaTableFill(table);
  const stateLabel = !table.isActive
    ? "Inactive"
    : table.busy
      ? "Busy"
      : table.nextAppointmentStartTime
        ? `Free — next ${table.nextAppointmentStartTime}`
        : "Free";

  if (tray) {
    return (
      <button
        type="button"
        data-table-id={table.tableId}
        onPointerDown={(e) => onPointerDown(e, table.tableId)}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onClick={tapHandlers.onClick}
        onDoubleClick={tapHandlers.onDoubleClick}
        title={`${table.label} — ${stateLabel}`}
        className={`rounded-lg px-3 py-2 text-sm border flex items-center gap-2 transition-opacity ${FILL_CLASS[fill]} ${
          canManage ? "cursor-grab active:cursor-grabbing touch-none" : "cursor-pointer"
        } ${dragging ? "opacity-30" : ""}`}
      >
        {table.label}
      </button>
    );
  }

  return (
    <button
      type="button"
      data-table-id={table.tableId}
      onPointerDown={(e) => onPointerDown(e, table.tableId)}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onClick={tapHandlers.onClick}
      onDoubleClick={tapHandlers.onDoubleClick}
      title={`${table.label} — ${stateLabel}`}
      style={style}
      className={`rounded-full w-11 h-11 flex items-center justify-center text-xs font-medium border-2 shadow transition-opacity ${FILL_CLASS[fill]} ${
        canManage ? "cursor-grab active:cursor-grabbing touch-none" : "cursor-pointer"
      } ${dragging ? "opacity-30" : ""}`}
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
