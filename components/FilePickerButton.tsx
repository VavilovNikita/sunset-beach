"use client";

import type { ChangeEvent, Ref } from "react";

// A file field in the interface's own style, in English. The browser's built-in control is drawn in the
// browser's language ("Choose file / No file chosen" in a Russian one) and cannot be styled; here the real
// <input type="file"> is hidden and a button opens it. `selectedText` says what was chosen (or nothing yet).
export default function FilePickerButton({
  accept,
  multiple,
  capture,
  disabled,
  label = "Choose file",
  selectedText,
  onChange,
  inputRef,
  tone = "coral",
}: {
  accept: string;
  multiple?: boolean;
  capture?: "environment" | "user";
  disabled?: boolean;
  label?: string;
  selectedText?: string | null;
  onChange: (e: ChangeEvent<HTMLInputElement>) => void;
  inputRef?: Ref<HTMLInputElement>;
  tone?: "coral" | "quiet";
}) {
  const button =
    tone === "coral"
      ? "bg-coral hover:bg-coraldeep text-cream"
      : "bg-cream/10 hover:bg-cream/20 text-cream";
  return (
    <label className={`inline-flex items-center gap-3 text-sm ${disabled ? "opacity-60" : ""}`}>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        capture={capture}
        disabled={disabled}
        onChange={onChange}
        className="sr-only peer"
      />
      <span
        className={`inline-flex items-center rounded-full px-4 py-2 font-medium transition-colors cursor-pointer peer-focus-visible:ring-2 peer-focus-visible:ring-coral ${button}`}
      >
        {label}
      </span>
      {selectedText !== undefined && <span className="text-cream/50 text-xs">{selectedText ?? "No file chosen"}</span>}
    </label>
  );
}
