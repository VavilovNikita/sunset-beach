// Client-side calls for the restaurant map - mirrors lib/spaMapClient.ts exactly. GET
// /restaurant-map is read server-side for first paint (app/admin/(dashboard)/pos/map/page.tsx);
// getRestaurantMap is the same read repeated for RestaurantTableMapView's poll.
import { adminRequest } from "@/lib/adminFetch";
import type { RestaurantMap } from "@/lib/posTypes";

export type RestaurantMapResult = { ok: true; map: RestaurantMap } | { ok: false; error: string };

export async function getRestaurantMap(): Promise<RestaurantMapResult> {
  const result = await adminRequest<RestaurantMap>("/restaurant-map", undefined, "Could not load the restaurant map.");
  if (!result.ok) return { ok: false, error: result.error };
  return { ok: true, map: result.data };
}

export async function uploadRestaurantMapImage(file: File): Promise<RestaurantMapResult> {
  const formData = new FormData();
  formData.append("file", file);
  const result = await adminRequest<RestaurantMap>(
    "/restaurant-map/image",
    { method: "POST", body: formData },
    "Could not upload the restaurant map."
  );
  if (!result.ok) return { ok: false, error: result.error };
  return { ok: true, map: result.data };
}
