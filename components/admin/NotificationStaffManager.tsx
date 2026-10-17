"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import ConfirmActionDialog from "@/components/admin/ConfirmActionDialog";
import ConfirmDialog from "@/components/admin/ConfirmDialog";
import TelegramSetupBanner from "@/components/admin/TelegramSetupBanner";
import {
  createNotificationLinkCode,
  fetchNotificationStaff,
  setNotificationStaffLanguage,
  unlinkNotificationChannel,
} from "@/lib/notificationClient";
import { NOTIFICATION_LANGUAGES, filterStaff, formatCountdown, languageLabel, linkAvailability, secondsLeft } from "@/lib/notifications";
import { formatTimestamp } from "@/lib/formatDate";
import type { NotificationLanguage, NotificationLinkCode, NotificationStaffMember, NotificationStatus } from "@/lib/types";

const INPUT = "bg-ink border border-cream/20 rounded-lg px-3 py-2 min-h-[44px] text-sm";
const SECONDARY = "min-h-[44px] rounded-full border border-cream/25 hover:border-coral px-4 text-sm transition-colors disabled:opacity-50";
const PRIMARY = "min-h-[44px] rounded-full bg-coral hover:bg-coraldeep transition-colors px-4 text-sm font-medium disabled:opacity-60";

// MANAGER+. Who has a Telegram chat linked and in which language their messages are written. A
// manager links a chat without the employee needing a login: Link Telegram shows a QR and a link
// that live 15 minutes and work once; the employee opens it and presses Start.
export default function NotificationStaffManager({
  initial,
  status,
  defaultLanguage,
}: {
  initial: NotificationStaffMember[];
  status: NotificationStatus | null;
  defaultLanguage?: NotificationLanguage;
}) {
  const [staff, setStaff] = useState(initial);
  const [query, setQuery] = useState("");
  const [onlyUnlinked, setOnlyUnlinked] = useState(false);
  const [linking, setLinking] = useState<NotificationStaffMember | null>(null);
  const [unlinking, setUnlinking] = useState<NotificationStaffMember | null>(null);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  // Errors of the language selects and of Link Telegram, each shown on the row that caused it.
  const [rowErrors, setRowErrors] = useState<Record<string, string>>({});
  const [busyRow, setBusyRow] = useState<string | null>(null);

  async function refresh() {
    const result = await fetchNotificationStaff();
    if (result.ok) {
      setStaff(result.data);
      setRefreshError(null);
    } else {
      // The list on screen is the last one that was read; say that it may be stale.
      setRefreshError(`Could not refresh the list (${result.error}). What is shown may be out of date.`);
    }
  }

  async function changeLanguage(member: NotificationStaffMember, value: string) {
    const language = value === "" ? null : (value as NotificationLanguage);
    setBusyRow(member.userId);
    setRowErrors((e) => ({ ...e, [member.userId]: "" }));
    const result = await setNotificationStaffLanguage(member.userId, language);
    setBusyRow(null);
    if (!result.ok) {
      setRowErrors((e) => ({ ...e, [member.userId]: result.error }));
      return;
    }
    setStaff((list) => list.map((m) => (m.userId === member.userId ? result.data : m)));
  }

  const shown = filterStaff(staff, query, onlyUnlinked);
  const linkedCount = staff.filter((m) => m.telegramLinked && m.isActive).length;
  const activeCount = staff.filter((m) => m.isActive).length;

  return (
    <div>
      <TelegramSetupBanner status={status} isAdmin={false} />

      <div className="flex flex-wrap items-center gap-3 mb-4">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Find by name"
          aria-label="Find by name"
          className={`${INPUT} w-64 placeholder:text-cream/30`}
        />
        <label className="flex items-center gap-2 text-sm text-cream/80 min-h-[44px]">
          <input type="checkbox" checked={onlyUnlinked} onChange={(e) => setOnlyUnlinked(e.target.checked)} className="accent-coral" />
          Not linked yet
        </label>
        <button type="button" onClick={refresh} className={SECONDARY}>
          Refresh
        </button>
        <span className="text-sm text-cream/50">
          {linkedCount} of {activeCount} active employees have Telegram linked
        </span>
      </div>
      {refreshError && <p className="text-sm text-coral mb-3">{refreshError}</p>}

      <div className="rounded-xl border border-cream/10 divide-y divide-cream/10">
        {shown.length === 0 && <p className="px-4 py-3 text-sm text-cream/50">Nobody matches.</p>}
        {shown.map((m) => {
          const availability = status ? linkAvailability(m, status) : { allowed: false, reason: "The notification status could not be read." };
          return (
            <div key={m.userId} className={`px-4 py-3 flex flex-wrap items-center gap-x-6 gap-y-2 ${m.isActive ? "" : "opacity-60"}`}>
              <div className="min-w-[12rem] flex-1">
                <p className="text-cream">
                  {m.name}
                  {!m.isActive && <span className="ml-2 text-xs text-cream/50">deactivated</span>}
                </p>
                <p className="text-xs text-cream/50">{m.role}</p>
              </div>

              <div className="min-w-[10rem]">
                <p className={`text-sm ${m.telegramLinked ? "text-green-600" : "text-cream/60"}`}>{m.telegramLinked ? "Telegram linked" : "Not linked"}</p>
                {m.telegramLinked && m.telegramLinkedAt && <p className="text-xs text-cream/50">since {formatTimestamp(m.telegramLinkedAt)}</p>}
              </div>

              <div>
                <label className="sr-only" htmlFor={`lang-${m.userId}`}>
                  Language of {m.name}
                </label>
                <select
                  id={`lang-${m.userId}`}
                  value={m.language ?? ""}
                  disabled={busyRow === m.userId}
                  onChange={(e) => changeLanguage(m, e.target.value)}
                  className={INPUT}
                >
                  <option value="">{languageLabel(undefined, defaultLanguage)}</option>
                  {NOTIFICATION_LANGUAGES.map((l) => (
                    <option key={l.value} value={l.value}>
                      {l.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-2">
                {m.telegramLinked ? (
                  <>
                    <button type="button" onClick={() => setLinking(m)} disabled={!availability.allowed} title={availability.reason} className={SECONDARY}>
                      Link another chat
                    </button>
                    <button type="button" onClick={() => setUnlinking(m)} className={SECONDARY}>
                      Unlink
                    </button>
                  </>
                ) : (
                  <button type="button" onClick={() => setLinking(m)} disabled={!availability.allowed} title={availability.reason} className={PRIMARY}>
                    Link Telegram
                  </button>
                )}
              </div>
              {!availability.allowed && !m.telegramLinked && m.isActive && <p className="w-full text-xs text-cream/50">{availability.reason}</p>}
              {rowErrors[m.userId] && <p className="w-full text-xs text-coral">{rowErrors[m.userId]}</p>}
            </div>
          );
        })}
      </div>

      {linking && (
        <LinkDialog
          member={linking}
          onClose={() => {
            setLinking(null);
            refresh();
          }}
        />
      )}

      {unlinking && (
        <ConfirmActionDialog
          eyebrow="Telegram"
          title={`Unlink ${unlinking.name}?`}
          confirmLabel="Unlink"
          busyLabel="Unlinking…"
          action={async () => {
            const result = await unlinkNotificationChannel(unlinking.userId);
            return result.ok ? null : result.error;
          }}
          onDone={() => {
            setUnlinking(null);
            refresh();
          }}
          onBack={() => setUnlinking(null)}
        >
          <p className="text-sm text-cream/70">They stop receiving messages in Telegram until a new link is made. Messages that are waiting for them will fail.</p>
        </ConfirmActionDialog>
      )}
    </div>
  );
}

// Creates the code when it opens, shows the QR and the link, counts the 15 minutes down and, once
// they are over, offers a fresh code instead of leaving a dead one on screen.
function LinkDialog({ member, onClose }: { member: NotificationStaffMember; onClose: () => void }) {
  const [code, setCode] = useState<NotificationLinkCode | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(true);
  const [now, setNow] = useState(() => Date.now());
  const [copied, setCopied] = useState(false);

  async function create() {
    setBusy(true);
    setError(null);
    setCopied(false);
    const result = await createNotificationLinkCode(member.userId);
    if (!result.ok) {
      setBusy(false);
      setCode(null);
      setQr(null);
      setError(result.error);
      return;
    }
    try {
      setQr(await QRCode.toDataURL(result.data.url, { width: 320, margin: 2 }));
    } catch {
      setQr(null);
      setError("Could not draw the QR code - the link below still works.");
    }
    setCode(result.data);
    setNow(Date.now());
    setBusy(false);
  }

  useEffect(() => {
    create();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!code) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [code]);

  const left = code ? secondsLeft(code.expiresAt, now) : 0;
  const expired = code !== null && left === 0;
  // Nothing usable on screen (no code yet because creating it failed, or it ran out): the button makes a new one.
  const needNew = expired || (code === null && error !== null);

  async function copy() {
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code.url);
      setCopied(true);
    } catch {
      setError("Could not copy - select the link and copy it by hand.");
    }
  }

  return (
    <ConfirmDialog
      eyebrow="Telegram"
      title={`Link ${member.name}`}
      confirmLabel={needNew ? "New link" : "Done"}
      busyLabel="Creating…"
      backLabel="Close"
      busy={busy}
      error={error}
      onConfirm={needNew ? create : onClose}
      onBack={onClose}
    >
      <div className="space-y-3 text-sm text-cream/80">
        <p>Ask {member.name} to scan the code or open the link on their phone and press <strong>Start</strong> in Telegram. The bot then answers “Linked”.</p>
        {busy && !code && <p className="text-cream/50">Creating the link…</p>}
        {code && (
          <>
            {qr && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={qr} alt={`QR code to link ${member.name}`} width={240} height={240} className={`mx-auto rounded bg-white ${expired ? "opacity-30" : ""}`} />
            )}
            <p className="break-all text-xs text-cream/60 select-all">{code.url}</p>
            <div className="flex items-center gap-3">
              <button type="button" onClick={copy} disabled={expired} className={SECONDARY}>
                {copied ? "Copied" : "Copy link"}
              </button>
              <span className={expired ? "text-coral" : "text-cream/60"}>
                {expired ? "This link has expired." : `Works once, for ${formatCountdown(left)} more.`}
              </span>
            </div>
          </>
        )}
      </div>
    </ConfirmDialog>
  );
}
