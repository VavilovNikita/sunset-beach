// /settings/print-layouts* (ADMIN only) through adminRequest. The page reads the saved layouts
// server-side (backendJson); these are the writes, the live preview and the logo upload.
import { adminRequest, adminJsonInit } from "@/lib/adminFetch";
import type { PrintAttemptResult } from "@/lib/posTypes";
import type { PrintLayout, PrintLayoutDocument, PrintLayoutInput, PrintLayoutPreview, PrintLayouts } from "@/lib/types";

export type PrintLayoutResult = { ok: true; layout: PrintLayout } | { ok: false; error: string };
export type PrintLayoutsResult = { ok: true; layouts: PrintLayouts } | { ok: false; error: string };

export async function savePrintLayout(doc: PrintLayoutDocument, input: PrintLayoutInput): Promise<PrintLayoutResult> {
  const result = await adminRequest<PrintLayout>(
    `/settings/print-layouts/${doc}`,
    adminJsonInit("PUT", input),
    "Could not save the layout.",
  );
  if (!result.ok) return { ok: false, error: result.error };
  return { ok: true, layout: result.data };
}

export async function previewPrintLayout(
  doc: PrintLayoutDocument,
  input: PrintLayoutInput,
): Promise<{ ok: true; preview: PrintLayoutPreview } | { ok: false; error: string }> {
  const result = await adminRequest<PrintLayoutPreview>(
    `/settings/print-layouts/${doc}/preview`,
    adminJsonInit("POST", input),
    "Could not render the preview.",
  );
  if (!result.ok) return { ok: false, error: result.error };
  return { ok: true, preview: result.data };
}

export async function uploadPrintLogo(file: File): Promise<PrintLayoutsResult> {
  const formData = new FormData();
  formData.append("file", file);
  const result = await adminRequest<PrintLayouts>(
    "/settings/print-layouts/logo",
    { method: "PUT", body: formData },
    "Could not upload the logo.",
  );
  if (!result.ok) return { ok: false, error: result.error };
  return { ok: true, layouts: result.data };
}

export async function deletePrintLogo(): Promise<PrintLayoutsResult> {
  const result = await adminRequest<PrintLayouts>("/settings/print-layouts/logo", adminJsonInit("DELETE"), "Could not remove the logo.");
  if (!result.ok) return { ok: false, error: result.error };
  return { ok: true, layouts: result.data };
}

export async function testPrintLayout(
  doc: PrintLayoutDocument,
): Promise<{ ok: true; result: PrintAttemptResult } | { ok: false; error: string }> {
  const result = await adminRequest<PrintAttemptResult>(
    `/settings/print-layouts/${doc}/test-print`,
    adminJsonInit("POST"),
    "Could not send the test print.",
  );
  if (!result.ok) return { ok: false, error: result.error };
  return { ok: true, result: result.data };
}
