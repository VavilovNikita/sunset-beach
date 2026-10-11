// /settings/receipt* (ADMIN only) through adminRequest. The page reads the saved settings
// server-side (backendJson); these are the writes, the live preview and the logo upload.
import { adminRequest, adminJsonInit } from "@/lib/adminFetch";
import type { PrintAttemptResult } from "@/lib/posTypes";
import type { ReceiptPreview, ReceiptSettings, ReceiptSettingsInput } from "@/lib/types";

export type ReceiptSettingsResult = { ok: true; settings: ReceiptSettings } | { ok: false; error: string };

export async function saveReceiptSettings(input: ReceiptSettingsInput): Promise<ReceiptSettingsResult> {
  const result = await adminRequest<ReceiptSettings>("/settings/receipt", adminJsonInit("PUT", input), "Could not save the receipt layout.");
  if (!result.ok) return { ok: false, error: result.error };
  return { ok: true, settings: result.data };
}

export async function previewReceipt(
  input: ReceiptSettingsInput,
): Promise<{ ok: true; preview: ReceiptPreview } | { ok: false; error: string }> {
  const result = await adminRequest<ReceiptPreview>(
    "/settings/receipt/preview",
    adminJsonInit("POST", input),
    "Could not render the preview.",
  );
  if (!result.ok) return { ok: false, error: result.error };
  return { ok: true, preview: result.data };
}

export async function uploadReceiptLogo(file: File): Promise<ReceiptSettingsResult> {
  const formData = new FormData();
  formData.append("file", file);
  const result = await adminRequest<ReceiptSettings>(
    "/settings/receipt/logo",
    { method: "PUT", body: formData },
    "Could not upload the logo.",
  );
  if (!result.ok) return { ok: false, error: result.error };
  return { ok: true, settings: result.data };
}

export async function deleteReceiptLogo(): Promise<ReceiptSettingsResult> {
  const result = await adminRequest<ReceiptSettings>("/settings/receipt/logo", adminJsonInit("DELETE"), "Could not remove the logo.");
  if (!result.ok) return { ok: false, error: result.error };
  return { ok: true, settings: result.data };
}

export async function testPrintReceipt(): Promise<{ ok: true; result: PrintAttemptResult } | { ok: false; error: string }> {
  const result = await adminRequest<PrintAttemptResult>(
    "/settings/receipt/test-print",
    adminJsonInit("POST"),
    "Could not send the test print.",
  );
  if (!result.ok) return { ok: false, error: result.error };
  return { ok: true, result: result.data };
}
