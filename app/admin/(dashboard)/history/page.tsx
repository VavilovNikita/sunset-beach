import Link from "next/link";
import { backendJson } from "@/lib/backendServer";
import { requireRoleAtLeast } from "@/lib/rbac";
import type { AuditAction, AuditEntityType, AuditLogPage } from "@/lib/types";

const ACTIONS: AuditAction[] = [
  "BOOKING_CREATED",
  "BOOKING_STATUS_CHANGED",
  "BOOKING_PAYMENT_NOTE_CHANGED",
  "BOOKING_SCHEDULE_CHANGED",
  "BOOKING_ROOM_ASSIGNED",
  "BOOKINGS_EXPORTED",
  "ROOM_PRICE_CHANGED",
  "RATE_OVERRIDE_CHANGED",
  "ORDER_CLOSED",
  "ORDER_CANCELLED",
  "ROOM_CHARGE_POSTED",
  "SHIFT_OPENED",
  "SHIFT_CLOSED",
  "SHIFT_EXPORTED",
  "USER_CREATED",
  "USER_ROLE_CHANGED",
  "USER_ACTIVE_CHANGED",
  "USER_PASSWORD_RESET",
  "ROOM_UNIT_CREATED",
  "ROOM_UNIT_UPDATED",
  "ROOM_UNIT_DELETED",
  "ROOM_UNIT_BLOCK_CREATED",
  "ROOM_UNIT_BLOCK_DELETED",
];

const ENTITY_TYPES: AuditEntityType[] = ["BOOKING", "ROOM", "ORDER", "SHIFT", "USER", "ROOM_UNIT"];

const PAGE_SIZE = 50;

// "BOOKING_STATUS_CHANGED" -> "Booking status changed", "ROOM_UNIT" -> "Room unit" - readable
// without a hand-maintained label table that would drift from the actual enum values over time.
function describeEnumValue(value: string): string {
  const lower = value.replace(/_/g, " ").toLowerCase();
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

function describeAction(action: AuditAction): string {
  return describeEnumValue(action);
}

export default async function AdminHistoryPage({
  searchParams,
}: {
  searchParams: { actorEmail?: string; action?: string; entityType?: string; entityId?: string; from?: string; to?: string; page?: string };
}) {
  await requireRoleAtLeast("MANAGER");

  const { actorEmail, action, entityType, entityId, from, to } = searchParams;
  const page = Math.max(0, Number(searchParams.page) || 0);

  const query = new URLSearchParams();
  if (actorEmail) query.set("actorEmail", actorEmail);
  if (action) query.set("action", action);
  if (entityType) query.set("entityType", entityType);
  if (entityId) query.set("entityId", entityId);
  if (from) query.set("from", from);
  if (to) query.set("to", to);
  query.set("page", String(page));
  query.set("pageSize", String(PAGE_SIZE));

  const result = await backendJson<AuditLogPage>(`/audit-log?${query.toString()}`, { auth: true });

  const filterQuery = new URLSearchParams(query);
  filterQuery.delete("page");
  const pageLink = (targetPage: number) => {
    const q = new URLSearchParams(filterQuery);
    q.set("page", String(targetPage));
    return `/admin/history?${q.toString()}`;
  };
  const hasNextPage = (page + 1) * PAGE_SIZE < result.totalCount;

  return (
    <div>
      <div className="mb-8">
        <p className="eyebrow text-sea mb-2">Audit trail</p>
        <h1 className="font-display italic text-3xl">History</h1>
        <p className="text-sm text-cream/50 mt-2">
          Read-only record of significant staff actions — money and guest data. {result.totalCount} matching entr
          {result.totalCount === 1 ? "y" : "ies"}.
        </p>
      </div>

      <form
        method="get"
        className="flex flex-wrap items-end gap-4 mb-8 bg-ink2/40 border border-cream/10 rounded-xl p-4"
      >
        <div>
          <label className="eyebrow text-cream/60 block mb-1">Staff email</label>
          <input
            type="text"
            name="actorEmail"
            defaultValue={actorEmail}
            placeholder="contains…"
            className="bg-ink2 border border-cream/20 rounded-lg px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="eyebrow text-cream/60 block mb-1">Action</label>
          <select
            name="action"
            defaultValue={action ?? ""}
            className="bg-ink2 border border-cream/20 rounded-lg px-3 py-2 text-sm"
          >
            <option value="">All</option>
            {ACTIONS.map((a) => (
              <option key={a} value={a}>
                {describeAction(a)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="eyebrow text-cream/60 block mb-1">Entity type</label>
          <select
            name="entityType"
            defaultValue={entityType ?? ""}
            className="bg-ink2 border border-cream/20 rounded-lg px-3 py-2 text-sm"
          >
            <option value="">All</option>
            {ENTITY_TYPES.map((t) => (
              <option key={t} value={t}>
                {describeEnumValue(t)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="eyebrow text-cream/60 block mb-1">Entity ID</label>
          <input
            type="text"
            name="entityId"
            defaultValue={entityId}
            placeholder="requires entity type"
            className="bg-ink2 border border-cream/20 rounded-lg px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="eyebrow text-cream/60 block mb-1">From</label>
          <input
            type="date"
            name="from"
            defaultValue={from}
            className="bg-ink2 border border-cream/20 rounded-lg px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="eyebrow text-cream/60 block mb-1">To</label>
          <input
            type="date"
            name="to"
            defaultValue={to}
            className="bg-ink2 border border-cream/20 rounded-lg px-3 py-2 text-sm"
          />
        </div>
        <button
          type="submit"
          className="rounded-full bg-coral hover:bg-coraldeep transition-colors px-5 py-2.5 text-sm font-medium"
        >
          Filter
        </button>
      </form>

      <div className="space-y-2">
        {result.items.length === 0 && <p className="text-sm text-cream/40">No matching entries.</p>}
        {result.items.map((entry) => (
          <div key={entry.id} className="bg-ink2/40 border border-cream/10 rounded-xl p-4 text-sm">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <span className="text-cream font-medium">{describeAction(entry.action)}</span>
              <span className="text-xs text-cream/40">{entry.createdAt.slice(0, 19).replace("T", " ")} UTC</span>
            </div>
            <p className="text-cream/70 mt-1">{entry.summary}</p>
            <p className="text-xs text-cream/40 mt-2">
              {entry.actorEmail} ({entry.actorRole})
              {entry.entityId && (
                <>
                  {" · "}
                  {describeEnumValue(entry.entityType)} {entry.entityId}
                </>
              )}
            </p>
          </div>
        ))}
      </div>

      {(page > 0 || hasNextPage) && (
        <div className="flex items-center justify-center gap-3 mt-8">
          <Link
            href={pageLink(Math.max(0, page - 1))}
            aria-disabled={page === 0}
            className={`rounded-full border border-cream/25 px-4 py-2 text-sm ${
              page === 0 ? "opacity-40 pointer-events-none" : "hover:border-cream/50 transition-colors"
            }`}
          >
            ← Prev
          </Link>
          <p className="text-cream/50 text-sm">Page {page + 1}</p>
          <Link
            href={pageLink(page + 1)}
            aria-disabled={!hasNextPage}
            className={`rounded-full border border-cream/25 px-4 py-2 text-sm ${
              !hasNextPage ? "opacity-40 pointer-events-none" : "hover:border-cream/50 transition-colors"
            }`}
          >
            Next →
          </Link>
        </div>
      )}
    </div>
  );
}
