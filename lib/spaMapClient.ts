// Shared client-side call for uploading/replacing the spa map's own background image -
// mirrors lib/propertyMapClient.ts's uploadPropertyMapImage exactly (same ok/error result
// shape, same adminRequest use, same multipart body). GET /spa-map itself is read server-side
// (backendJson, in app/admin/(dashboard)/spa/map/page.tsx) - this file only needs the write,
// same split as the property map's own client/page split.
import { adminRequest } from "@/lib/adminFetch";
import type { SpaMap } from "@/lib/posTypes";

export type UploadSpaMapImageResult = { ok: true; map: SpaMap } | { ok: false; error: string };

export async function uploadSpaMapImage(file: File): Promise<UploadSpaMapImageResult> {
  const formData = new FormData();
  formData.append("file", file);
  const result = await adminRequest<SpaMap>("/spa-map/image", { method: "POST", body: formData }, "Could not upload the spa map.");
  if (!result.ok) return { ok: false, error: result.error };
  return { ok: true, map: result.data };
}
