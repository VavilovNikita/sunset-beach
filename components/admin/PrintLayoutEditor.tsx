"use client";

import { useEffect, useRef, useState } from "react";
import {
  deletePrintLogo,
  previewPrintLayout,
  savePrintLayout,
  testPrintLayout,
  uploadPrintLogo,
} from "@/lib/printLayoutClient";
import {
  FONT_B_WIDTH_RATIO,
  MAX_PRINT_TEXT_LINES,
  MAX_PRINT_TEXT_LINE_LENGTH,
  MAX_PRINT_TITLE,
  PRINT_CONTROLS,
  PRINT_DOCUMENTS,
  logoWidthShare,
  printLayoutInputsEqual,
  printLayoutProblem,
  toPrintLayoutInput,
} from "@/lib/printLayout";
import type {
  PrintGlyphSize,
  PrintLayout,
  PrintLayoutDocument,
  PrintLayoutInput,
  PrintLayoutPreview,
  PrintLayouts,
} from "@/lib/types";

const fieldClass = "w-full bg-ink border border-cream/20 rounded-lg px-3 py-2 text-sm placeholder:text-cream/30";
const chipBase = "rounded-full border px-3 py-1 text-sm transition-colors";

type Forms = Record<PrintLayoutDocument, PrintLayoutInput>;
type Saved = Record<PrintLayoutDocument, PrintLayout>;

function byDocument(layouts: PrintLayout[]): Saved {
  return Object.fromEntries(layouts.map((l) => [l.documentType, l])) as Saved;
}

// Where a test print of each document goes - the department of the printer it is sent to.
const TEST_PRINTER: Record<PrintLayoutDocument, string> = {
  RECEIPT: "receipt (cashier)",
  PREBILL: "receipt (cashier)",
  KITCHEN_TICKET: "kitchen",
  BAR_TICKET: "bar",
  Z_REPORT: "receipt (cashier)",
};

// The print-layout designer: one tab per printed document, the form on the left, the
// server-rendered sample on the right. The sample comes from POST /settings/print-layouts/{doc}/preview
// - the same code that builds the printed bytes - so what wraps or gets cut here is what happens on
// paper. Save replaces every field of the open tab; edits on other tabs are kept until saved or
// discarded. The logo is one shared image with its own upload and applies at once.
export default function PrintLayoutEditor({ initial }: { initial: PrintLayouts }) {
  const [saved, setSaved] = useState<Saved>(byDocument(initial.layouts));
  const [forms, setForms] = useState<Forms>(
    () => Object.fromEntries(initial.layouts.map((l) => [l.documentType, toPrintLayoutInput(l)])) as Forms,
  );
  const [hasLogo, setHasLogo] = useState(initial.hasLogo);
  const [active, setActive] = useState<PrintLayoutDocument>("RECEIPT");
  const [preview, setPreview] = useState<PrintLayoutPreview | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [logoBusy, setLogoBusy] = useState(false);
  const [logoError, setLogoError] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; text: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const form = forms[active];
  const controls = PRINT_CONTROLS[active];
  const dirty = !printLayoutInputsEqual(form, toPrintLayoutInput(saved[active]));
  const problem = printLayoutProblem(form);
  const dirtyDocs = new Set(PRINT_DOCUMENTS.filter((d) => !printLayoutInputsEqual(forms[d.type], toPrintLayoutInput(saved[d.type]))).map((d) => d.type));

  function set<K extends keyof PrintLayoutInput>(key: K, value: PrintLayoutInput[K]) {
    setForms((f) => ({ ...f, [active]: { ...f[active], [key]: value } }));
    setMessage(null);
  }

  function openTab(doc: PrintLayoutDocument) {
    setActive(doc);
    setError(null);
    setMessage(null);
    setTestResult(null);
    setPreview(null);
  }

  // Re-render the sample shortly after the last edit. A response for an older edit (or another
  // tab) is dropped, so a slow reply can't overwrite a newer one. A rejected edit keeps the last
  // good sample on screen and says why next to it.
  const latest = useRef(0);
  useEffect(() => {
    if (problem) {
      setPreviewError(problem);
      return;
    }
    const ticket = ++latest.current;
    const timer = setTimeout(async () => {
      const result = await previewPrintLayout(active, form);
      if (ticket !== latest.current) return;
      if (result.ok) {
        setPreview(result.preview);
        setPreviewError(null);
      } else {
        setPreviewError(result.error);
      }
    }, 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, JSON.stringify(form), hasLogo, problem]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    if (problem) {
      setError(problem);
      return;
    }
    setSaving(true);
    const result = await savePrintLayout(active, form);
    setSaving(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setSaved((s) => ({ ...s, [active]: result.layout }));
    setForms((f) => ({ ...f, [active]: toPrintLayoutInput(result.layout) }));
    setMessage("Saved. Applies to the next one printed.");
  }

  async function handleLogoFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setLogoError(null);
    setLogoBusy(true);
    const result = await uploadPrintLogo(file);
    setLogoBusy(false);
    if (!result.ok) {
      setLogoError(result.error);
      return;
    }
    // The upload stored the logo only; unsaved edits to the layouts stay as they are.
    setHasLogo(result.layouts.hasLogo);
  }

  async function handleLogoRemove() {
    setLogoError(null);
    setLogoBusy(true);
    const result = await deletePrintLogo();
    setLogoBusy(false);
    if (!result.ok) {
      setLogoError(result.error);
      return;
    }
    // Removing also switched "print the logo" off on every layout, server-side.
    setHasLogo(false);
    setSaved((s) => ({ ...s, ...byDocument(result.layouts.layouts) }));
    setForms((f) => {
      const next = { ...f };
      for (const d of PRINT_DOCUMENTS) next[d.type] = { ...next[d.type], showLogo: false };
      return next;
    });
  }

  async function handleTestPrint() {
    setTestResult(null);
    setTesting(true);
    const result = await testPrintLayout(active);
    setTesting(false);
    if (!result.ok) {
      setTestResult({ ok: false, text: result.error });
      return;
    }
    const { attempted, job } = result.result;
    if (!attempted) {
      setTestResult({ ok: false, text: `No active ${TEST_PRINTER[active]} printer is set up - add one under POS → Printers.` });
    } else if (job?.status === "SENT") {
      setTestResult({ ok: true, text: "Sent to the printer." });
    } else {
      setTestResult({ ok: false, text: `The printer did not take it${job?.lastError ? `: ${job.lastError}` : "."} It stays in the print queue and will be retried.` });
    }
  }

  const sizeOptions: [string, string][] = [
    ["1", "Normal"],
    ["2", "Double"],
  ];
  const asSize = (v: string): PrintGlyphSize => (v === "2" ? 2 : 1);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2 border-b border-cream/10 pb-3" role="tablist">
        {PRINT_DOCUMENTS.map((d) => (
          <button
            key={d.type}
            type="button"
            role="tab"
            aria-selected={active === d.type}
            onClick={() => openTab(d.type)}
            className={`${chipBase} ${active === d.type ? "border-coral bg-coral/20 text-cream" : "border-cream/20 text-cream/70 hover:bg-cream/10"}`}
          >
            {d.label}
            {dirtyDocs.has(d.type) && <span className="ml-1 text-amber-400" title="Unsaved changes">●</span>}
          </button>
        ))}
      </div>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_auto] items-start">
        <form onSubmit={handleSave} className="space-y-4 max-w-xl w-full">
          <Card title="Paper and font">
            <Row label="Paper">
              <Choice
                value={form.paperWidth}
                options={[
                  ["MM80", "80 mm"],
                  ["MM58", "58 mm"],
                ]}
                onChange={(v) => set("paperWidth", v)}
              />
            </Row>
            <Row label="Text font">
              <Choice
                value={form.bodyFont}
                options={[
                  ["A", "A — larger"],
                  ["B", "B — smaller, denser"],
                ]}
                onChange={(v) => set("bodyFont", v)}
              />
            </Row>
            <p className="text-xs text-cream/40">
              The roll of the printer this document goes to. A receipt printer has no choice of typefaces: these two built-in fonts, plus double size and
              bold, are everything it can print.
            </p>
          </Card>

          {controls.logo && (
            <Card title="Logo">
              <input ref={fileRef} type="file" accept="image/png,image/jpeg" onChange={handleLogoFile} className="hidden" />
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  disabled={logoBusy}
                  onClick={() => fileRef.current?.click()}
                  className="rounded-full border border-cream/30 hover:bg-cream/10 px-4 py-1.5 text-sm disabled:opacity-60"
                >
                  {logoBusy ? "Working…" : hasLogo ? "Replace logo" : "Upload logo"}
                </button>
                {hasLogo && (
                  <button
                    type="button"
                    disabled={logoBusy}
                    onClick={handleLogoRemove}
                    className="rounded-full border border-coral/50 text-coral hover:bg-coral/10 px-4 py-1.5 text-sm disabled:opacity-60"
                  >
                    Remove
                  </button>
                )}
              </div>
              <p className="text-xs text-cream/40">
                PNG or JPEG, shared by the receipt and the pre-bill. It prints in black and white, so a simple dark-on-light mark works best. It is stored as
                soon as it is uploaded.
              </p>
              {logoError && <p className="text-xs text-coral">{logoError}</p>}
              {hasLogo && (
                <>
                  <Check label="Print the logo on this document" checked={form.showLogo} onChange={(v) => set("showLogo", v)} />
                  <label className="flex items-center gap-3 text-sm text-cream">
                    <input
                      type="range"
                      min={20}
                      max={100}
                      step={5}
                      value={form.logoWidthPercent}
                      onChange={(e) => set("logoWidthPercent", Number(e.target.value))}
                      className="accent-coral"
                    />
                    Width {form.logoWidthPercent}%
                  </label>
                </>
              )}
            </Card>
          )}

          {controls.headerFooter && (
            <Card title="Header">
              <Area
                label="Under the logo — hotel name, address, phone, tax id"
                value={form.headerText}
                onChange={(v) => set("headerText", v)}
                placeholder={"Sunset Beach Resort\n12 Beach Rd, Koh Samui\nTax ID 0000000000000"}
              />
              <Check label="Bold" checked={form.headerBold} onChange={(v) => set("headerBold", v)} />
            </Card>
          )}

          <Card title="Title">
            <Field label="Title" value={form.title} onChange={(v) => set("title", v)} max={MAX_PRINT_TITLE} />
            <Row label="Title size">
              <Choice value={String(form.titleSize)} options={sizeOptions} onChange={(v) => set("titleSize", asSize(v))} />
            </Row>
            {active === "RECEIPT" && <p className="text-xs text-cream/40">A reprint adds “ - COPY” to the title.</p>}
            {(active === "KITCHEN_TICKET" || active === "BAR_TICKET") && (
              <p className="text-xs text-cream/40">
                A void ticket (a sent line taken back) follows this layout too, but always carries the title “*** VOID ***” so it can't be mistaken for an order.
              </p>
            )}
          </Card>

          {(controls.orderLines || controls.time || controls.waiter || controls.itemNotes || controls.itemSize) && (
            <Card title="Lines to show">
              {controls.orderLines && (
                <>
                  <Check label="Table / location" checked={form.showLocation} onChange={(v) => set("showLocation", v)} />
                  {form.showLocation && (
                    <Row label="Location size">
                      <Choice value={String(form.locationSize)} options={sizeOptions} onChange={(v) => set("locationSize", asSize(v))} />
                    </Row>
                  )}
                  <Check label="Order number" checked={form.showOrderNumber} onChange={(v) => set("showOrderNumber", v)} />
                </>
              )}
              {controls.time && <Check label={controls.timeLabel} checked={form.showTime} onChange={(v) => set("showTime", v)} />}
              {controls.waiter && <Check label="Waiter" checked={form.showWaiter} onChange={(v) => set("showWaiter", v)} />}
              {controls.itemNotes && <Check label="Notes under items" checked={form.showItemNotes} onChange={(v) => set("showItemNotes", v)} />}
              {controls.itemSize && (
                <Row label="Item size">
                  <Choice value={String(form.itemSize)} options={sizeOptions} onChange={(v) => set("itemSize", asSize(v))} />
                </Row>
              )}
              {controls.vat && <Check label="“incl. VAT” line under the total" checked={form.showVatLine} onChange={(v) => set("showVatLine", v)} />}
              {controls.payment && (
                <Check label="Payment method (paid receipts)" checked={form.showPaymentMethod} onChange={(v) => set("showPaymentMethod", v)} />
              )}
              {controls.total && (
                <>
                  <Row label="Total size">
                    <Choice value={String(form.totalSize)} options={sizeOptions} onChange={(v) => set("totalSize", asSize(v))} />
                  </Row>
                  <Check label="Total in bold" checked={form.totalBold} onChange={(v) => set("totalBold", v)} />
                </>
              )}
            </Card>
          )}

          {controls.headerFooter && (
            <Card title="Footer">
              <Area
                label="Last lines — a thank-you, opening hours"
                value={form.footerText}
                onChange={(v) => set("footerText", v)}
                placeholder="Thank you for dining with us!"
              />
            </Card>
          )}

          {error && <p className="text-xs text-coral">{error}</p>}
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="submit"
              disabled={saving || !dirty || problem !== null}
              className="rounded-full bg-coral hover:bg-coraldeep transition-colors px-5 py-2 text-sm font-medium disabled:opacity-60"
            >
              {saving ? "Saving…" : "Save"}
            </button>
            {dirty && !saving && (
              <button
                type="button"
                onClick={() => {
                  setForms((f) => ({ ...f, [active]: toPrintLayoutInput(saved[active]) }));
                  setError(null);
                }}
                className="text-sm text-cream/60 hover:text-cream underline"
              >
                Discard changes
              </button>
            )}
            {message && <span className="text-sm text-cream/60">{message}</span>}
          </div>

          <div className="border-t border-cream/10 pt-4 space-y-2">
            <button
              type="button"
              disabled={testing || dirty}
              onClick={handleTestPrint}
              className="rounded-full border border-cream/30 hover:bg-cream/10 px-4 py-1.5 text-sm disabled:opacity-50"
            >
              {testing ? "Sending…" : "Print a test"}
            </button>
            <p className="text-xs text-cream/40">
              Prints a sample on the {TEST_PRINTER[active]} printer with the <em>saved</em> layout{dirty ? " — save your changes first" : ""}. The sample
              says it is not a real order. Paper width and the logo only show their true look on the real printer.
            </p>
            {testResult && <p className={testResult.ok ? "text-xs text-sea" : "text-xs text-coral"}>{testResult.text}</p>}
          </div>
        </form>

        <PreviewPane preview={preview} error={previewError} paperWidth={form.paperWidth} />
      </div>
    </div>
  );
}

function PreviewPane({ preview, error, paperWidth }: { preview: PrintLayoutPreview | null; error: string | null; paperWidth: PrintLayoutInput["paperWidth"] }) {
  return (
    <div className="lg:sticky lg:top-6 space-y-2">
      <p className="eyebrow text-cream/60">Preview</p>
      {error && <p className="text-xs text-coral max-w-xs">{error}</p>}
      {preview ? (
        <div
          className="bg-white text-black rounded-sm shadow-lg px-4 py-5 font-mono text-[13px] leading-tight overflow-hidden"
          style={{ width: `calc(${preview.columns}ch + 2rem)` }}
        >
          {preview.logoPngBase64 && preview.logoWidthDots && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={`data:image/png;base64,${preview.logoPngBase64}`}
              alt="Logo"
              className="mx-auto block"
              style={{ width: `${logoWidthShare(preview.logoWidthDots, paperWidth)}%`, imageRendering: "pixelated" }}
            />
          )}
          {preview.lines.map((line, i) => (
            <div
              key={i}
              className="whitespace-pre"
              style={{
                textAlign: line.center ? "center" : "left",
                fontWeight: line.bold ? 700 : 400,
                fontSize: `${(line.fontB ? FONT_B_WIDTH_RATIO : 1) * line.size}em`,
                minHeight: "1.1em",
              }}
            >
              {line.text}
            </div>
          ))}
          <div className="text-center text-[10px] text-black/40 pt-3">— cut —</div>
        </div>
      ) : (
        !error && <p className="text-sm text-cream/50">Rendering…</p>
      )}
      <p className="text-xs text-cream/40 max-w-xs">A sample, laid out by the same code that prints the real document.</p>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-ink2/40 border border-cream/10 rounded-xl p-5 space-y-3">
      <p className="text-sm text-cream font-medium">{title}</p>
      {children}
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <span className="text-sm text-cream/70 w-28">{label}</span>
      {children}
    </div>
  );
}

function Choice<T extends string>({ value, options, onChange }: { value: T; options: [T, string][]; onChange: (v: T) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map(([v, label]) => (
        <button
          key={v}
          type="button"
          aria-pressed={value === v}
          onClick={() => onChange(v)}
          className={`${chipBase} ${value === v ? "border-coral bg-coral/20 text-cream" : "border-cream/20 text-cream/70 hover:bg-cream/10"}`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

function Check({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-2 text-sm text-cream">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="accent-coral" />
      {label}
    </label>
  );
}

function Field({ label, value, onChange, max }: { label: string; value: string; onChange: (v: string) => void; max: number }) {
  return (
    <div>
      <label className="eyebrow text-cream/60 block mb-1">{label}</label>
      <input value={value} onChange={(e) => onChange(e.target.value)} maxLength={max} className={fieldClass} />
    </div>
  );
}

function Area({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <div>
      <label className="eyebrow text-cream/60 block mb-1">{label}</label>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={4}
        placeholder={placeholder}
        className={`${fieldClass} font-mono`}
      />
      <p className="text-xs text-cream/40 mt-1">
        Up to {MAX_PRINT_TEXT_LINES} lines of {MAX_PRINT_TEXT_LINE_LENGTH} characters, printed centred. Symbols the printer's code page doesn't have print
        as “?”.
      </p>
    </div>
  );
}
