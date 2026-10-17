"use client";

import { useState } from "react";
import { fetchNotificationLog } from "@/lib/notificationClient";
import {
  DELIVERY_STATUSES,
  DELIVERY_STATUS_LABELS,
  LOG_LIMIT,
  NOTIFICATION_TYPES,
  NOTIFICATION_TYPE_LABELS,
  deliveryStatusClass,
  logFiltersError,
  type LogFilters,
} from "@/lib/notifications";
import { formatTimestamp } from "@/lib/formatDate";
import type { NotificationDeliveryStatus, NotificationLogEntry, NotificationType } from "@/lib/types";

const INPUT = "bg-ink border border-cream/20 rounded-lg px-3 py-2 min-h-[44px] text-sm";

// MANAGER+. Who was told what, when, and whether it arrived. The first page is read on the server;
// changing a filter asks again (the dates are hotel days).
export default function NotificationLog({
  initialEntries,
  initialFilters,
  initialError,
}: {
  initialEntries: NotificationLogEntry[];
  initialFilters: LogFilters;
  initialError: string | null;
}) {
  const [filters, setFilters] = useState(initialFilters);
  const [entries, setEntries] = useState(initialEntries);
  const [error, setError] = useState<string | null>(initialError);
  const [loading, setLoading] = useState(false);

  async function load(next: LogFilters) {
    setFilters(next);
    const invalid = logFiltersError(next);
    if (invalid) {
      setError(invalid);
      return;
    }
    setLoading(true);
    setError(null);
    const result = await fetchNotificationLog(next);
    setLoading(false);
    if (!result.ok) {
      // Keep the rows of the last good read on screen, but say they are not the ones asked for.
      setError(`${result.error} The list below is from the previous filter.`);
      return;
    }
    setEntries(result.data);
  }

  return (
    <div>
      <div className="flex flex-wrap items-end gap-4 mb-4">
        <div>
          <label className="eyebrow text-cream/60 block mb-1" htmlFor="log-from">
            From
          </label>
          <input id="log-from" type="date" value={filters.from} onChange={(e) => load({ ...filters, from: e.target.value })} className={INPUT} />
        </div>
        <div>
          <label className="eyebrow text-cream/60 block mb-1" htmlFor="log-to">
            To
          </label>
          <input id="log-to" type="date" value={filters.to} min={filters.from || undefined} onChange={(e) => load({ ...filters, to: e.target.value })} className={INPUT} />
        </div>
        <div>
          <label className="eyebrow text-cream/60 block mb-1" htmlFor="log-type">
            Kind
          </label>
          <select id="log-type" value={filters.type} onChange={(e) => load({ ...filters, type: e.target.value as NotificationType | "" })} className={INPUT}>
            <option value="">All</option>
            {NOTIFICATION_TYPES.map((t) => (
              <option key={t} value={t}>
                {NOTIFICATION_TYPE_LABELS[t]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="eyebrow text-cream/60 block mb-1" htmlFor="log-status">
            Delivery
          </label>
          <select
            id="log-status"
            value={filters.deliveryStatus}
            onChange={(e) => load({ ...filters, deliveryStatus: e.target.value as NotificationDeliveryStatus | "" })}
            className={INPUT}
          >
            <option value="">All</option>
            {DELIVERY_STATUSES.map((s) => (
              <option key={s} value={s}>
                {DELIVERY_STATUS_LABELS[s]}
              </option>
            ))}
          </select>
        </div>
        <button
          type="button"
          onClick={() => load(filters)}
          disabled={loading}
          className="min-h-[44px] rounded-full border border-cream/25 hover:border-coral px-4 text-sm transition-colors disabled:opacity-50"
        >
          {loading ? "Loading…" : "Refresh"}
        </button>
      </div>

      {error && <p className="text-sm text-coral mb-3">{error}</p>}

      <div className="rounded-xl border border-cream/10 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-cream/60 border-b border-cream/10">
              <th className="px-3 py-2 font-normal">When</th>
              <th className="px-3 py-2 font-normal">To</th>
              <th className="px-3 py-2 font-normal">Kind</th>
              <th className="px-3 py-2 font-normal">Message</th>
              <th className="px-3 py-2 font-normal">Delivery</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-cream/10">
            {entries.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-4 text-cream/50">
                  {error ? "Nothing to show." : "No notifications match."}
                </td>
              </tr>
            )}
            {entries.map((n) => (
              <tr key={n.id} className="align-top">
                <td className="px-3 py-2 whitespace-nowrap text-cream/80">{formatTimestamp(n.createdAt)}</td>
                <td className="px-3 py-2 whitespace-nowrap">{n.recipientName}</td>
                <td className="px-3 py-2 whitespace-nowrap text-cream/80">{NOTIFICATION_TYPE_LABELS[n.type]}</td>
                <td className="px-3 py-2 whitespace-pre-line max-w-md break-words text-cream/80">{n.text}</td>
                <td className="px-3 py-2">
                  <span className={`inline-block rounded-full border px-2 py-0.5 text-xs ${deliveryStatusClass(n.deliveryStatus)}`}>
                    {DELIVERY_STATUS_LABELS[n.deliveryStatus]}
                  </span>
                  {n.deliveryStatus === "SENT" && n.sentAt && <p className="text-xs text-cream/50 mt-1">{formatTimestamp(n.sentAt)}</p>}
                  {n.deliveryStatus === "PENDING" && n.sendAfter && <p className="text-xs text-cream/50 mt-1">not before {formatTimestamp(n.sendAfter)}</p>}
                  {n.attempts > 1 && <p className="text-xs text-cream/50 mt-1">{n.attempts} attempts</p>}
                  {n.error && <p className="text-xs text-coral mt-1">{n.error}</p>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {entries.length >= LOG_LIMIT && <p className="text-xs text-cream/50 mt-2">Showing the latest {LOG_LIMIT}. Narrow the dates to see older ones.</p>}
    </div>
  );
}
