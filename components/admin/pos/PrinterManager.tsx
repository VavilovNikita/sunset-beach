"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ADMIN_API_URL } from "@/lib/backend";
import { extractApiError } from "@/lib/apiError";
import { PRINTER_DEPARTMENT_LABELS, PRINT_JOB_STATUS_LABELS } from "@/lib/posOrders";
import DeleteButton from "@/components/admin/DeleteButton";
import type { Printer, PrinterInput, PrinterDepartment, PrinterCodepage, PrintJob } from "@/lib/posTypes";

const DEPARTMENTS: PrinterDepartment[] = ["KITCHEN", "BAR", "CASHIER"];
const CODEPAGES: PrinterCodepage[] = ["PC437", "TIS620"];
const EMPTY_FORM: PrinterInput = { name: "", department: "KITCHEN", host: "", port: 9100, codepage: "PC437", isActive: true };

function PrinterFields({ values, onChange }: { values: PrinterInput; onChange: (values: PrinterInput) => void }) {
  return (
    <div className="grid sm:grid-cols-6 gap-3 items-end">
      <div className="sm:col-span-2">
        <label className="eyebrow text-cream/60 block mb-1">Name</label>
        <input
          type="text"
          required
          minLength={2}
          maxLength={120}
          value={values.name}
          onChange={(e) => onChange({ ...values, name: e.target.value })}
          placeholder="e.g. Kitchen — line 1"
          className="w-full bg-transparent border-b border-cream/25 py-2 text-cream text-sm placeholder:text-cream/40 focus:outline-none focus:border-coral"
        />
      </div>
      <div>
        <label className="eyebrow text-cream/60 block mb-1">Department</label>
        <select
          value={values.department}
          onChange={(e) => onChange({ ...values, department: e.target.value as PrinterDepartment })}
          className="w-full bg-ink2 border-b border-cream/25 py-2 text-cream text-sm focus:outline-none focus:border-coral"
        >
          {DEPARTMENTS.map((d) => (
            <option key={d} value={d}>
              {PRINTER_DEPARTMENT_LABELS[d]}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="eyebrow text-cream/60 block mb-1">Host</label>
        <input
          type="text"
          required
          minLength={1}
          maxLength={255}
          value={values.host}
          onChange={(e) => onChange({ ...values, host: e.target.value })}
          placeholder="192.168.1.50"
          className="w-full bg-transparent border-b border-cream/25 py-2 text-cream text-sm placeholder:text-cream/40 focus:outline-none focus:border-coral"
        />
      </div>
      <div>
        <label className="eyebrow text-cream/60 block mb-1">Port</label>
        <input
          type="number"
          required
          min={1}
          max={65535}
          value={values.port ?? 9100}
          onChange={(e) => onChange({ ...values, port: Number(e.target.value) })}
          className="w-full bg-transparent border-b border-cream/25 py-2 text-cream text-sm focus:outline-none focus:border-coral"
        />
      </div>
      <div>
        <label className="eyebrow text-cream/60 block mb-1">Codepage</label>
        <select
          value={values.codepage ?? "PC437"}
          onChange={(e) => onChange({ ...values, codepage: e.target.value as PrinterCodepage })}
          className="w-full bg-ink2 border-b border-cream/25 py-2 text-cream text-sm focus:outline-none focus:border-coral"
        >
          {CODEPAGES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>
      <label className="flex items-center gap-2 text-sm text-cream/70 pb-2 sm:col-span-6">
        <input
          type="checkbox"
          checked={values.isActive ?? true}
          onChange={(e) => onChange({ ...values, isActive: e.target.checked })}
          className="accent-coral"
        />
        Active — the live printer for this department (only one active printer allowed per department)
      </label>
    </div>
  );
}

function TestPrintButton({ printerId }: { printerId: string }) {
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<PrintJob | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleTest() {
    setTesting(true);
    setError(null);
    setResult(null);

    const res = await fetch(`${ADMIN_API_URL}/printers/${printerId}/test`, {
      method: "POST",
      credentials: "include",
    });
    setTesting(false);

    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setError(extractApiError(data, "Could not reach the printer."));
      return;
    }
    setResult(await res.json());
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={handleTest}
        disabled={testing}
        className="text-sm text-sea hover:text-coral transition-colors disabled:opacity-60"
      >
        {testing ? "Printing…" : "Test print"}
      </button>
      {result && (
        <span className={`text-xs ${result.status === "SENT" ? "text-green-400" : "text-coral"}`}>
          {result.status === "SENT"
            ? "Printed successfully"
            : `${PRINT_JOB_STATUS_LABELS[result.status]}${result.lastError ? ` — ${result.lastError}` : ""}`}
        </span>
      )}
      {error && <span className="text-xs text-coral">{error}</span>}
    </div>
  );
}

export default function PrinterManager({ initialPrinters }: { initialPrinters: Printer[] }) {
  const router = useRouter();
  const [printers, setPrinters] = useState(initialPrinters);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<PrinterInput>(EMPTY_FORM);
  const [creating, setCreating] = useState(false);
  const [newValues, setNewValues] = useState<PrinterInput>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function startEdit(printer: Printer) {
    setEditingId(printer.id);
    setEditValues({
      name: printer.name,
      department: printer.department,
      host: printer.host,
      port: printer.port,
      codepage: printer.codepage,
      isActive: printer.isActive,
    });
    setError(null);
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const res = await fetch(`${ADMIN_API_URL}/printers`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newValues),
    });

    setSubmitting(false);

    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setError(extractApiError(data, "Could not create printer."));
      return;
    }
    const created: Printer = await res.json();
    setPrinters((prev) => [...prev, created]);
    setNewValues(EMPTY_FORM);
    setCreating(false);
    router.refresh();
  }

  // PATCH is a full replace on this API, same as TableManager/MenuItemForm.
  async function handleSaveEdit(id: string) {
    setSubmitting(true);
    setError(null);

    const res = await fetch(`${ADMIN_API_URL}/printers/${id}`, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(editValues),
    });

    setSubmitting(false);

    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setError(extractApiError(data, "Could not save printer."));
      return;
    }
    const updated: Printer = await res.json();
    setPrinters((prev) => prev.map((p) => (p.id === id ? updated : p)));
    setEditingId(null);
    router.refresh();
  }

  function handleDeleted(id: string) {
    setPrinters((prev) => prev.filter((p) => p.id !== id));
    router.refresh();
  }

  return (
    <div className="max-w-4xl">
      {printers.length === 0 && (
        <p className="text-cream/50 text-sm mb-4">No printers set up yet — add one below.</p>
      )}

      <div className="space-y-2">
        {printers.map((printer) =>
          editingId === printer.id ? (
            <div key={printer.id} className="bg-ink2/40 border border-cream/10 rounded-xl p-4 space-y-3">
              <PrinterFields values={editValues} onChange={setEditValues} />
              <div className="flex gap-3">
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => handleSaveEdit(printer.id)}
                  className="rounded-full bg-coral hover:bg-coraldeep transition-colors px-5 py-2 text-sm font-medium disabled:opacity-60"
                >
                  {submitting ? "Saving…" : "Save"}
                </button>
                <button
                  type="button"
                  onClick={() => setEditingId(null)}
                  className="text-sm text-cream/50 hover:text-cream transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div key={printer.id} className="flex items-center gap-4 bg-ink2/40 border border-cream/10 rounded-xl p-4">
              <div className="flex-1 min-w-0">
                <p className="font-display text-lg">
                  {printer.name}{" "}
                  <span className="text-cream/40 text-sm">· {PRINTER_DEPARTMENT_LABELS[printer.department]}</span>
                </p>
                <p className="text-sm text-cream/60">
                  {printer.host}:{printer.port} · {printer.codepage}
                  {!printer.isActive && " · Inactive"}
                </p>
              </div>
              <TestPrintButton printerId={printer.id} />
              <button
                type="button"
                onClick={() => startEdit(printer)}
                className="text-sm text-sea hover:text-coral transition-colors"
              >
                Edit
              </button>
              <DeleteButton
                url={`${ADMIN_API_URL}/printers/${printer.id}`}
                confirmText={`Delete "${printer.name}"? This can't be undone.`}
                conflictMessage={`"${printer.name}" has print jobs on record and can't be deleted. Deactivate it instead (Edit → uncheck Active) to stop routing new jobs to it while keeping its history.`}
                onDeleted={() => handleDeleted(printer.id)}
              />
            </div>
          )
        )}
      </div>

      <div className="mt-4">
        {creating ? (
          <form onSubmit={handleCreate} className="bg-ink2/40 border border-cream/10 rounded-xl p-4 space-y-3">
            <p className="eyebrow text-cream/60">New printer</p>
            <PrinterFields values={newValues} onChange={setNewValues} />
            <div className="flex gap-3">
              <button
                type="submit"
                disabled={submitting}
                className="rounded-full bg-coral hover:bg-coraldeep transition-colors px-5 py-2 text-sm font-medium disabled:opacity-60"
              >
                {submitting ? "Creating…" : "Create printer"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setCreating(false);
                  setNewValues(EMPTY_FORM);
                  setError(null);
                }}
                className="text-sm text-cream/50 hover:text-cream transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="rounded-full bg-coral hover:bg-coraldeep transition-colors px-5 py-2.5 text-sm font-medium"
          >
            New printer
          </button>
        )}
      </div>

      {error && <p className="text-sm text-coral mt-3">{error}</p>}
    </div>
  );
}
