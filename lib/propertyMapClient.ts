// Shared client-side calls for the property map (GET/POST /property-map/image,
// PATCH /room-units/positions) - mirrors lib/bookingRepriceClient.ts's exact pattern (same
// ok/error result shape, same adminRequest use). Viewing is CASHIER+; placing rooms and
// replacing the background image are MANAGER+ on the backend.
import { adminRequest } from "@/lib/adminFetch";
import type { PropertyMap, RoomUnit, RoomUnitPositionInput } from "@/lib/types";

export type PropertyMapResult = { ok: true; map: PropertyMap } | { ok: false; error: string };
export type SavePositionsResult = { ok: true; units: RoomUnit[] } | { ok: false; error: string };
export type UploadPropertyMapImageResult = { ok: true; map: PropertyMap } | { ok: false; error: string };

export async function getPropertyMap(): Promise<PropertyMapResult> {
  const result = await adminRequest<PropertyMap>("/property-map", undefined, "Could not load the property map.");
  if (!result.ok) return { ok: false, error: result.error };
  return { ok: true, map: result.data };
}

export async function saveRoomUnitPositions(items: RoomUnitPositionInput[]): Promise<SavePositionsResult> {
  const result = await adminRequest<RoomUnit[]>(
    "/room-units/positions",
    { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(items) },
    "Could not save the layout."
  );
  if (!result.ok) return { ok: false, error: result.error };
  return { ok: true, units: result.data };
}

export async function uploadPropertyMapImage(file: File): Promise<UploadPropertyMapImageResult> {
  const formData = new FormData();
  formData.append("file", file);
  const result = await adminRequest<PropertyMap>("/property-map/image", { method: "POST", body: formData }, "Could not upload the plan.");
  if (!result.ok) return { ok: false, error: result.error };
  return { ok: true, map: result.data };
}
