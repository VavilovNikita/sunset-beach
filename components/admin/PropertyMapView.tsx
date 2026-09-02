"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toDateKey } from "@/lib/bookings";
import { saveRoomUnitPositions, uploadPropertyMapImage } from "@/lib/propertyMapClient";
import { resolveUnitDisplay, type UnitBadge, type UnitFill } from "@/lib/propertyMapDisplay";
import type { PropertyMap, PropertyMapUnit, RoomUnitPositionInput } from "@/lib/types";
import PropertyMapUnitPanel from "./PropertyMapUnitPanel";

// Pointer-drag mechanics mirror BookingCalendarGrid.tsx's own approach (native Pointer Events,
// no library, pointer capture on the element the drag started from, touchAction disabled on the
// container only while a drag is active so a tablet doesn't scroll mid-drag, Escape cancels the
// in-progress drag). It diverges in one place, deliberately: the calendar hit-tests discrete day
// cells via elementFromPoint because "which room + which date" is all it ever needs; this screen
// places rooms at continuous coordinates, so instead it reads the background image's
// getBoundingClientRect() once at pointerdown and does pure arithmetic against it for the rest of
// the drag - no repeated layout reads, and the final position is only computed once, on drop.
const CLICK_THRESHOLD_PX = 6;

type PendingPosition = { positionX: number | null; positionY: number | null };

type DragState = {
  roomUnitId: string;
  imgRect: DOMRect;
  startX: number;
  startY: number;
  x: number;
  y: number;
};

const FILL_CLASS: Record<UnitFill, string> = {
  inactive: "bg-cream/10 text-cream/40 border-cream/15",
  occupied: "bg-ink2 text-cream border-cream/30",
  blocked: "bg-coral text-cream border-coraldeep",
  vacant: "bg-sea text-ink border-sea",
};

const BADGE_DOT_CLASS: Record<UnitBadge, string> = {
  debt: "bg-amber-400",
  dirty: "bg-sand",
  "departing-today": "bg-cream",
  "arriving-today": "bg-cream",
  "blocked-while-occupied": "bg-coral",
};

const BADGE_LABEL: Record<UnitBadge, string> = {
  debt: "Owes money",
  dirty: "Not cleaned",
  "departing-today": "Leaving today",
  "arriving-today": "Arriving today",
  "blocked-while-occupied": "Also blocked today",
};

export default function PropertyMapView({ initialMap, canManage }: { initialMap: PropertyMap; canManage: boolean }) {
  const router = useRouter();
  const today = toDateKey(new Date());

  const [pending, setPending] = useState<Record<string, PendingPosition>>({});
  const [drag, setDrag] = useState<DragState | null>(null);
  const [selectedUnitId, setSelectedUnitId] = useState<string | null>(null);
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

  function effectivePosition(unit: PropertyMapUnit): PendingPosition {
    return pending[unit.roomUnitId] ?? { positionX: unit.positionX, positionY: unit.positionY };
  }

  const placedUnits = initialMap.units.filter((u) => effectivePosition(u).positionX !== null);
  const unplacedUnits = initialMap.units.filter((u) => effectivePosition(u).positionX === null);
  const pendingCount = Object.keys(pending).length;

  function onTilePointerDown(e: React.PointerEvent<HTMLButtonElement>, unitId: string) {
    if (!canManage || !initialMap.imagePath) return;
    const imgRect = imageWrapperRef.current?.getBoundingClientRect();
    if (!imgRect) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    if (containerRef.current) containerRef.current.style.touchAction = "none";
    setDrag({ roomUnitId: unitId, imgRect, startX: e.clientX, startY: e.clientY, x: e.clientX, y: e.clientY });
  }

  function onDragPointerMove(e: React.PointerEvent<HTMLButtonElement>) {
    if (!drag || drag.roomUnitId !== dragTargetId(e)) return;
    setDrag((prev) => (prev ? { ...prev, x: e.clientX, y: e.clientY } : prev));
  }

  function onDragPointerUp(e: React.PointerEvent<HTMLButtonElement>) {
    if (!drag) return;
    if (containerRef.current) containerRef.current.style.touchAction = "";
    const finished = drag;
    setDrag(null);

    const moved = Math.hypot(e.clientX - finished.startX, e.clientY - finished.startY);
    if (moved < CLICK_THRESHOLD_PX) {
      setSelectedUnitId(finished.roomUnitId);
      return;
    }

    const { imgRect } = finished;
    const withinX = e.clientX >= imgRect.left && e.clientX <= imgRect.right;
    const withinY = e.clientY >= imgRect.top && e.clientY <= imgRect.bottom;
    if (withinX && withinY) {
      const positionX = round4(clamp01((e.clientX - imgRect.left) / imgRect.width));
      const positionY = round4(clamp01((e.clientY - imgRect.top) / imgRect.height));
      setPending((prev) => ({ ...prev, [finished.roomUnitId]: { positionX, positionY } }));
    } else {
      setPending((prev) => ({ ...prev, [finished.roomUnitId]: { positionX: null, positionY: null } }));
    }
  }

  // setPointerCapture means every subsequent pointer event for this gesture still targets the
  // original element regardless of where the pointer physically is - this just confirms the move
  // event belongs to the button currently tracked in `drag`, not some other tile.
  function dragTargetId(e: React.PointerEvent<HTMLButtonElement>): string | undefined {
    return e.currentTarget.dataset.roomUnitId;
  }

  async function handleSaveLayout() {
    setSaving(true);
    setSaveError(null);
    const items: RoomUnitPositionInput[] = Object.entries(pending).map(([roomUnitId, pos]) => ({ roomUnitId, ...pos }));
    const result = await saveRoomUnitPositions(items);
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
    const result = await uploadPropertyMapImage(file);
    setUploading(false);
    if (!result.ok) {
      setUploadError(result.error);
      return;
    }
    router.refresh();
  }

  const selectedUnit = initialMap.units.find((u) => u.roomUnitId === selectedUnitId) ?? null;
  const draggedUnit = drag ? initialMap.units.find((u) => u.roomUnitId === drag.roomUnitId) : null;

  return (
    <div ref={containerRef}>
      {canManage && (
        <PropertyMapUploadForm hasImage={Boolean(initialMap.imagePath)} uploading={uploading} error={uploadError} onUpload={handleUpload} />
      )}

      <div className="flex flex-col lg:flex-row gap-6 mt-4">
        <div className="flex-1 min-w-0 overflow-x-auto pb-2">
          {initialMap.imagePath ? (
            <div ref={imageWrapperRef} className="relative inline-block select-none">
              {/* eslint-disable-next-line @next/next/no-img-element -- authenticated, proxied image; next/image can't reach it */}
              <img
                src={`/api/admin-proxy/property-map/image?v=${encodeURIComponent(initialMap.imageUpdatedAt ?? "")}`}
                alt="Property map"
                className="block w-[960px] max-w-none rounded-xl border border-cream/10"
                draggable={false}
              />
              {placedUnits.map((unit) => {
                const pos = effectivePosition(unit);
                const display = resolveUnitDisplay(unit, today);
                const isDragging = drag?.roomUnitId === unit.roomUnitId;
                return (
                  <RoomTile
                    key={unit.roomUnitId}
                    unit={unit}
                    display={display}
                    canManage={canManage}
                    dragging={isDragging}
                    onPointerDown={onTilePointerDown}
                    onPointerMove={onDragPointerMove}
                    onPointerUp={onDragPointerUp}
                    onClick={() => setSelectedUnitId(unit.roomUnitId)}
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
          ) : (
            <div className="rounded-xl border border-dashed border-cream/20 p-10 text-center text-sm text-cream/50 min-w-[480px]">
              {canManage ? "Upload a floor plan above to start placing rooms." : "No property map has been uploaded yet."}
            </div>
          )}
        </div>

        <div className="w-full lg:w-60 shrink-0">
          <p className="eyebrow text-cream/50 mb-2">Not on the map{unplacedUnits.length > 0 ? ` (${unplacedUnits.length})` : ""}</p>
          {unplacedUnits.length === 0 ? (
            <p className="text-sm text-cream/40">Every room is placed.</p>
          ) : (
            <div className="flex flex-wrap lg:flex-col gap-2">
              {unplacedUnits.map((unit) => {
                const display = resolveUnitDisplay(unit, today);
                return (
                  <RoomTile
                    key={unit.roomUnitId}
                    unit={unit}
                    display={display}
                    canManage={canManage}
                    dragging={drag?.roomUnitId === unit.roomUnitId}
                    tray
                    onPointerDown={onTilePointerDown}
                    onPointerMove={onDragPointerMove}
                    onPointerUp={onDragPointerUp}
                    onClick={() => setSelectedUnitId(unit.roomUnitId)}
                  />
                );
              })}
            </div>
          )}
        </div>
      </div>

      {drag && draggedUnit && (
        <div
          className="fixed z-50 pointer-events-none rounded-full w-11 h-11 flex items-center justify-center text-xs font-medium border-2 bg-ink2 text-cream border-cream/50 shadow-lg"
          style={{ left: drag.x, top: drag.y, transform: "translate(-50%, -50%)" }}
        >
          {draggedUnit.unitLabel}
        </div>
      )}

      {canManage && pendingCount > 0 && (
        <div className="sticky bottom-4 mt-4 flex flex-wrap items-center gap-3 bg-ink2 border border-cream/20 rounded-xl px-4 py-3 shadow-2xl">
          <span className="text-sm text-cream/70">
            {pendingCount} room{pendingCount === 1 ? "" : "s"} moved
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

      {selectedUnit && (
        <PropertyMapUnitPanel
          unit={selectedUnit}
          onClose={() => setSelectedUnitId(null)}
          onSaved={() => {
            setSelectedUnitId(null);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

function RoomTile({
  unit,
  display,
  canManage,
  dragging,
  tray,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onClick,
  style,
}: {
  unit: PropertyMapUnit;
  display: { fill: UnitFill; badges: UnitBadge[] };
  canManage: boolean;
  dragging: boolean;
  tray?: boolean;
  onPointerDown: (e: React.PointerEvent<HTMLButtonElement>, unitId: string) => void;
  onPointerMove: (e: React.PointerEvent<HTMLButtonElement>) => void;
  onPointerUp: (e: React.PointerEvent<HTMLButtonElement>) => void;
  onClick: () => void;
  style?: React.CSSProperties;
}) {
  const topBadge = display.badges[0];

  if (tray) {
    return (
      <button
        type="button"
        data-room-unit-id={unit.roomUnitId}
        onPointerDown={(e) => onPointerDown(e, unit.roomUnitId)}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onClick={canManage ? undefined : onClick}
        title={topBadge ? BADGE_LABEL[topBadge] : undefined}
        className={`rounded-lg px-3 py-2 text-sm border flex items-center gap-2 transition-opacity ${FILL_CLASS[display.fill]} ${
          canManage ? "cursor-grab active:cursor-grabbing touch-none" : "cursor-pointer"
        } ${dragging ? "opacity-30" : ""}`}
      >
        {unit.unitLabel}
        {topBadge && <span className={`w-2 h-2 rounded-full ${BADGE_DOT_CLASS[topBadge]}`} />}
      </button>
    );
  }

  return (
    <button
      type="button"
      data-room-unit-id={unit.roomUnitId}
      onPointerDown={(e) => onPointerDown(e, unit.roomUnitId)}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onClick={canManage ? undefined : onClick}
      title={`${unit.unitLabel}${topBadge ? ` — ${BADGE_LABEL[topBadge]}` : ""}`}
      style={style}
      className={`rounded-full w-11 h-11 flex items-center justify-center text-xs font-medium border-2 shadow transition-opacity ${FILL_CLASS[display.fill]} ${
        canManage ? "cursor-grab active:cursor-grabbing touch-none" : "cursor-pointer"
      } ${dragging ? "opacity-30" : ""}`}
    >
      {unit.unitLabel}
      {topBadge && <span className={`absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full border border-ink2 ${BADGE_DOT_CLASS[topBadge]}`} />}
    </button>
  );
}

function PropertyMapUploadForm({
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
