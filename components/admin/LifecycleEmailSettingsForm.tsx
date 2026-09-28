"use client";

import { useState } from "react";
import { saveLifecycleEmailSettings } from "@/lib/lifecycleEmailSettingsClient";
import { parseWholeNumberInRange } from "@/lib/lifecycleEmails";
import type { LifecycleEmailSettings } from "@/lib/types";

const inputClass = "w-24 bg-ink border border-cream/20 rounded-lg px-3 py-2 text-sm";

// The three automated guest emails, one card each: an on/off switch plus its timing. Saved as a
// whole (PUT replaces every field), and the server's figures are what's shown after a save.
export default function LifecycleEmailSettingsForm({ initial }: { initial: LifecycleEmailSettings }) {
  const [preArrivalEnabled, setPreArrivalEnabled] = useState(initial.preArrivalEnabled);
  const [preArrivalDays, setPreArrivalDays] = useState(String(initial.preArrivalDaysBefore));
  const [postStayEnabled, setPostStayEnabled] = useState(initial.postStayEnabled);
  const [postStayDays, setPostStayDays] = useState(String(initial.postStayDaysAfter));
  const [reviewUrl, setReviewUrl] = useState(initial.postStayReviewUrl ?? "");
  const [winBackEnabled, setWinBackEnabled] = useState(initial.winBackEnabled);
  const [winBackMonths, setWinBackMonths] = useState(String(initial.winBackMonthsSinceStay));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSavedAt(null);

    const preArrivalDaysBefore = parseWholeNumberInRange(preArrivalDays, 0, 60);
    const postStayDaysAfter = parseWholeNumberInRange(postStayDays, 0, 60);
    const winBackMonthsSinceStay = parseWholeNumberInRange(winBackMonths, 1, 120);
    if (preArrivalDaysBefore === null || postStayDaysAfter === null) {
      setError("Days must be a whole number from 0 to 60.");
      return;
    }
    if (winBackMonthsSinceStay === null) {
      setError("Months must be a whole number from 1 to 120.");
      return;
    }

    setSaving(true);
    const result = await saveLifecycleEmailSettings({
      preArrivalEnabled,
      preArrivalDaysBefore,
      postStayEnabled,
      postStayDaysAfter,
      postStayReviewUrl: reviewUrl.trim() || null,
      winBackEnabled,
      winBackMonthsSinceStay,
    });
    setSaving(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }
    const s = result.settings;
    setPreArrivalEnabled(s.preArrivalEnabled);
    setPreArrivalDays(String(s.preArrivalDaysBefore));
    setPostStayEnabled(s.postStayEnabled);
    setPostStayDays(String(s.postStayDaysAfter));
    setReviewUrl(s.postStayReviewUrl ?? "");
    setWinBackEnabled(s.winBackEnabled);
    setWinBackMonths(String(s.winBackMonthsSinceStay));
    setSavedAt("Saved.");
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Section
        title="Pre-arrival"
        description="A reminder before the guest arrives, with their room and dates. Not sent for cancelled bookings."
        enabled={preArrivalEnabled}
        onToggle={setPreArrivalEnabled}
      >
        <label className="flex items-center gap-3 text-sm text-cream">
          <input value={preArrivalDays} onChange={(e) => setPreArrivalDays(e.target.value)} inputMode="numeric" className={inputClass} />
          days before check-in
        </label>
      </Section>

      <Section
        title="Post-stay"
        description="A thank-you after checkout. Not sent for cancelled bookings or no-shows."
        enabled={postStayEnabled}
        onToggle={setPostStayEnabled}
      >
        <label className="flex items-center gap-3 text-sm text-cream">
          <input value={postStayDays} onChange={(e) => setPostStayDays(e.target.value)} inputMode="numeric" className={inputClass} />
          days after check-out
        </label>
        <div>
          <label className="eyebrow text-cream/60 block mb-1">Review link</label>
          <input
            value={reviewUrl}
            onChange={(e) => setReviewUrl(e.target.value)}
            type="url"
            placeholder="https://…"
            className="w-full bg-ink border border-cream/20 rounded-lg px-3 py-2 text-sm placeholder:text-cream/30"
          />
          <p className="text-xs text-cream/40 mt-1">Optional. Left blank, the email goes out without a review section.</p>
        </div>
      </Section>

      <Section
        title="Win-back"
        description="An invitation to return, for a guest whose last stay was a long time ago. Repeated no more often than the same interval."
        enabled={winBackEnabled}
        onToggle={setWinBackEnabled}
      >
        <label className="flex items-center gap-3 text-sm text-cream">
          <input value={winBackMonths} onChange={(e) => setWinBackMonths(e.target.value)} inputMode="numeric" className={inputClass} />
          months since their last stay
        </label>
      </Section>

      {error && <p className="text-xs text-coral">{error}</p>}
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={saving}
          className="rounded-full bg-coral hover:bg-coraldeep transition-colors px-5 py-2 text-sm font-medium disabled:opacity-60"
        >
          {saving ? "Saving…" : "Save"}
        </button>
        {savedAt && <span className="text-sm text-cream/60">{savedAt}</span>}
      </div>
    </form>
  );
}

function Section({
  title,
  description,
  enabled,
  onToggle,
  children,
}: {
  title: string;
  description: string;
  enabled: boolean;
  onToggle: (value: boolean) => void;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-ink2/40 border border-cream/10 rounded-xl p-5 space-y-3">
      <label className="flex items-center gap-2 text-sm text-cream font-medium">
        <input type="checkbox" checked={enabled} onChange={(e) => onToggle(e.target.checked)} className="accent-coral" />
        {title}
      </label>
      <p className="text-xs text-cream/50">{description}</p>
      <div className={enabled ? "space-y-3" : "space-y-3 opacity-50"}>{children}</div>
    </div>
  );
}
