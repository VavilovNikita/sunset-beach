// Shared client-side calls for /printers (components/admin/pos/PrinterManager.tsx).
import { adminRequest, adminJsonInit } from "@/lib/adminFetch";
import type { Printer, PrinterInput, PrintJob } from "@/lib/posTypes";

export type SavePrinterResult = { ok: true; printer: Printer } | { ok: false; error: string };
export type TestPrintResult = { ok: true; job: PrintJob } | { ok: false; error: string };

export async function createPrinter(input: PrinterInput): Promise<SavePrinterResult> {
  const result = await adminRequest<Printer>("/printers", adminJsonInit("POST", input), "Could not create printer.");
  if (!result.ok) return { ok: false, error: result.error };
  return { ok: true, printer: result.data };
}

// PATCH is a full replace on this API, same as TableManager/MenuItemForm.
export async function updatePrinter(id: string, input: PrinterInput): Promise<SavePrinterResult> {
  const result = await adminRequest<Printer>(`/printers/${id}`, adminJsonInit("PATCH", input), "Could not save printer.");
  if (!result.ok) return { ok: false, error: result.error };
  return { ok: true, printer: result.data };
}

export async function testPrint(printerId: string): Promise<TestPrintResult> {
  const result = await adminRequest<PrintJob>(`/printers/${printerId}/test`, adminJsonInit("POST"), "Could not reach the printer.");
  if (!result.ok) return { ok: false, error: result.error };
  return { ok: true, job: result.data };
}
