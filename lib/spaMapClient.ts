// Shared client-side calls for the spa map - mirrors lib/propertyMapClient.ts's own shape
// exactly (same ok/error result, same adminRequest use). GET /spa-map is still read server-side
// for the page's first paint (backendJson, in app/admin/(dashboard)/spa/map/page.tsx); getSpaMap
// below is the same read repeated client-side, for SpaTableMapView's own poll (the map now
// carries live busy/free state, which goes stale the moment nobody refetches it - see that
// component's own comment).
import { adminRequest } from "@/lib/adminFetch";
import type { SpaMap } from "@/lib/posTypes";

export type SpaMapResult = { ok: true; map: SpaMap } | { ok: false; error: string };
export type UploadSpaMapImageResult = { ok: true; map: SpaMap } | { ok: false; error: string };

export async function getSpaMap(): Promise<SpaMapResult> {
  const result = await adminRequest<SpaMap>("/spa-map", undefined, "Could not load the spa map.");
  if (!result.ok) return { ok: false, error: result.error };
  return { ok: true, map: result.data };
}

export async function uploadSpaMapImage(file: File): Promise<UploadSpaMapImageResult> {
  const formData = new FormData();
  formData.append("file", file);
  const result = await adminRequest<SpaMap>("/spa-map/image", { method: "POST", body: formData }, "Could not upload the spa map.");
  if (!result.ok) return { ok: false, error: result.error };
  return { ok: true, map: result.data };
}
