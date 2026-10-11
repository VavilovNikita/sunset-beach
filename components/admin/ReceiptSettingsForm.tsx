"use client";

import { useEffect, useRef, useState } from "react";
import {
  deleteReceiptLogo,
  previewReceipt,
  saveReceiptSettings,
  testPrintReceipt,
  uploadReceiptLogo,
} from "@/lib/receiptSettingsClient";
import {
  FONT_B_WIDTH_RATIO,
  MAX_RECEIPT_TEXT_LINES,
  MAX_RECEIPT_TEXT_LINE_LENGTH,
  MAX_RECEIPT_TITLE,
  logoWidthShare,
  receiptInputProblem,
  receiptInputsEqual,
  toReceiptInput,
} from "@/lib/receiptSettings";
import type { ReceiptPreview, ReceiptSettings, ReceiptSettingsInput } from "@/lib/types";

const fieldClass = "w-full bg-ink border border-cream/20 rounded-lg px-3 py-2 text-sm placeholder:text-cream/30";
const chipBase = "rounded-full border px-3 py-1 text-sm transition-colors";

// The receipt designer: the form on the left, the server-rendered sample on the right. The sample
// comes from POST /settings/receipt/preview - the same code that builds the printed bytes - so
// what wraps or gets cut here is what happens on paper. Saving replaces every field; the logo is
// its own upload and applies at once (it is not part of the Save).
export default function ReceiptSettingsForm({ initial }: { initial: ReceiptSettings }) {
  const [saved, setSaved] = useState(initial);
  const [form, setForm] = useState<ReceiptSettingsInput>(toReceiptInput(initial));
  const [preview, setPreview] = useState<ReceiptPreview | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [logoBusy, setLogoBusy] = useState(false);
  const [logoError, setLogoError] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; text: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const dirty = !receiptInputsEqual(form, toReceiptInput(saved));
  const problem = receiptInputProblem(form);

  function set<K extends keyof ReceiptSettingsInput>(key: K, value: ReceiptSettingsInput[K]) {
    setForm((f) => ({ ...f, [key]: value }));
    setMessage(null);
  }

  // Re-render the sample shortly after the last edit. A response for an older edit is dropped, so
  // a slow reply can't overwrite a newer one. A rejected edit keeps the last good sample on screen
  // and says why next to it.
  const latest = useRef(0);
  useEffect(() => {
    if (problem) {
      setPreviewError(problem);
      return;
    }
    const ticket = ++latest.current;
    const timer = setTimeout(async () => {
      const result = await previewReceipt(form);
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
  }, [JSON.stringify(form), saved.hasLogo, problem]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    if (problem) {
      setError(problem);
      return;
    }
    setSaving(true);
    const result = await saveReceiptSettings(form);
    setSaving(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setSaved(result.settings);
    setForm(toReceiptInput(result.settings));
    setMessage("Saved. Applies to the next receipt or pre-bill printed.");
  }

  async function handleLogoFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setLogoError(null);
    setLogoBusy(true);
    const result = await uploadReceiptLogo(file);
    setLogoBusy(false);
    if (!result.ok) {
      setLogoError(result.error);
      return;
    }
    // The upload saved the logo only; keep unsaved edits to the rest of the form.
    setSaved((s) => ({ ...s, hasLogo: result.settings.hasLogo, updatedAt: result.settings.updatedAt }));
  }

  async function handleLogoRemove() {
    setLogoError(null);
    setLogoBusy(true);
    const result = await deleteReceiptLogo();
    setLogoBusy(false);
    if (!result.ok) {
      setLogoError(result.error);
      return;
    }
    // Removing also switched "print the logo" off on the server.
    setSaved((s) => ({ ...s, hasLogo: false, showLogo: false, updatedAt: result.settings.updatedAt }));
    setForm((f) => ({ ...f, showLogo: false }));
  }

  async function handleTestPrint() {
    setTestResult(null);
    setTesting(true);
    const result = await testPrintReceipt();
    setTesting(false);
    if (!result.ok) {
      setTestResult({ ok: false, text: result.error });
      return;
    }
    const { attempted, job } = result.result;
    if (!attempted) {
      setTestResult({ ok: false, text: "No active receipt (cashier) printer is set up - add one under POS → Printers." });
    } else if (job?.status === "SENT") {
      setTestResult({ ok: true, text: "Sent to the printer." });
    } else {
      setTestResult({ ok: false, text: `The printer did not take it${job?.lastError ? `: ${job.lastError}` : "."} It stays in the print queue and will be retried.` });
    }
  }

  return (
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
            A receipt printer has no choice of typefaces: these two built-in fonts, plus double size and bold, are everything it can print.
          </p>
        </Card>

        <Card title="Logo">
          <input ref={fileRef} type="file" accept="image/png,image/jpeg" onChange={handleLogoFile} className="hidden" />
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              disabled={logoBusy}
              onClick={() => fileRef.current?.click()}
              className="rounded-full border border-cream/30 hover:bg-cream/10 px-4 py-1.5 text-sm disabled:opacity-60"
            >
              {logoBusy ? "Working…" : saved.hasLogo ? "Replace logo" : "Upload logo"}
            </button>
            {saved.hasLogo && (
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
            PNG or JPEG. It prints in black and white, so a simple dark-on-light mark works best. The logo is stored as soon as it is uploaded.
          </p>
          {logoError && <p className="text-xs text-coral">{logoError}</p>}
          {saved.hasLogo && (
            <>
              <Check label="Print the logo" checked={form.showLogo} onChange={(v) => set("showLogo", v)} />
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

        <Card title="Header">
          <Area
            label="Under the logo — hotel name, address, phone, tax id"
            value={form.headerText}
            onChange={(v) => set("headerText", v)}
            placeholder={"Sunset Beach Resort\n12 Beach Rd, Koh Samui\nTax ID 0000000000000"}
          />
          <Check label="Bold" checked={form.headerBold} onChange={(v) => set("headerBold", v)} />
        </Card>

        <Card title="Titles">
          <Field label="Receipt title" value={form.receiptTitle} onChange={(v) => set("receiptTitle", v)} max={MAX_RECEIPT_TITLE} />
          <Field label="Pre-bill title" value={form.prebillTitle} onChange={(v) => set("prebillTitle", v)} max={MAX_RECEIPT_TITLE} />
          <Row label="Title size">
            <Choice
              value={String(form.titleSize)}
              options={[
                ["1", "Normal"],
                ["2", "Double"],
              ]}
              onChange={(v) => set("titleSize", v === "2" ? 2 : 1)}
            />
          </Row>
          <p className="text-xs text-cream/40">A reprint adds “ - COPY” to the receipt title.</p>
        </Card>

        <Card title="Lines to show">
          <Check label="Order number" checked={form.showOrderNumber} onChange={(v) => set("showOrderNumber", v)} />
          <Check label="Date and time" checked={form.showTime} onChange={(v) => set("showTime", v)} />
          <Check label="“incl. VAT” line under the total" checked={form.showVatLine} onChange={(v) => set("showVatLine", v)} />
          <Check label="Payment method (paid receipts)" checked={form.showPaymentMethod} onChange={(v) => set("showPaymentMethod", v)} />
          <Row label="Total size">
            <Choice
              value={String(form.totalSize)}
              options={[
                ["1", "Normal"],
                ["2", "Double"],
              ]}
              onChange={(v) => set("totalSize", v === "2" ? 2 : 1)}
            />
          </Row>
          <Check label="Total in bold" checked={form.totalBold} onChange={(v) => set("totalBold", v)} />
        </Card>

        <Card title="Footer">
          <Area
            label="Last lines — a thank-you, opening hours"
            value={form.footerText}
            onChange={(v) => set("footerText", v)}
            placeholder="Thank you for dining with us!"
          />
        </Card>

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
                setForm(toReceiptInput(saved));
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
            {testing ? "Sending…" : "Print a test receipt"}
          </button>
          <p className="text-xs text-cream/40">
            Prints a sample on the receipt printer with the <em>saved</em> layout{dirty ? " — save your changes first" : ""}. Paper width and the logo
            only show their true look on the real printer.
          </p>
          {testResult && <p className={testResult.ok ? "text-xs text-sea" : "text-xs text-coral"}>{testResult.text}</p>}
        </div>
      </form>

      <PreviewPane preview={preview} error={previewError} paperWidth={form.paperWidth} />
    </div>
  );
}

function PreviewPane({ preview, error, paperWidth }: { preview: ReceiptPreview | null; error: string | null; paperWidth: ReceiptSettingsInput["paperWidth"] }) {
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
      <p className="text-xs text-cream/40 max-w-xs">A sample order, laid out by the same code that prints the real receipt.</p>
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
      <span className="text-sm text-cream/70 w-24">{label}</span>
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
        Up to {MAX_RECEIPT_TEXT_LINES} lines of {MAX_RECEIPT_TEXT_LINE_LENGTH} characters, printed centred. The printer's Thai code page is used when
        the receipt printer is set to Thai; other symbols may print as “?”.
      </p>
    </div>
  );
}
