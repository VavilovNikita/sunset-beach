import type { Role } from "@/lib/session";

// How the History page shows an audit entry to a person. The server writes each entry's summary
// once, as plain text, and it embeds raw values - full record ids ("from order 41f8b768-4105-…")
// and enum values ("with ROOM_CHARGE payment", "from NEW to CONFIRMED"). Entries are immutable, so
// rewording the server's sentences would only fix new rows; this reads every row, old and new.

const UUID = /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi;
const IS_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// MULTI_WORD enum values are unambiguous. A single upper-case word is only an enum value when it
// is one of these - "VIP" in a guest tag or a shift code like "OP" must stay as written.
const MULTI_WORD_ENUM = /\b[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+\b/g;
const SINGLE_WORD_ENUMS = new Set([
  "NEW",
  "CONFIRMED",
  "PAID",
  "CANCELLED",
  "OPEN",
  "SENT",
  "BOOKED",
  "COMPLETED",
  "DONE",
  "PENDING",
  "FAILED",
  "CASH",
  "CARD",
  "OTHER",
  "ADMIN",
  "MANAGER",
  "CASHIER",
  "WAITER",
  "DIRECT",
  "CLEAN",
  "DIRTY",
  "INSPECTED",
  "KITCHEN",
  "BAR",
  "SPA",
  "MORNING",
  "EVENING",
  "SPLIT",
  "ABSENCE",
]);
const SINGLE_WORD = /\b[A-Z]{2,}\b/g;

const ROLE_LABELS: Record<Role, string> = {
  ADMIN: "Admin",
  MANAGER: "Manager",
  CASHIER: "Cashier",
  WAITER: "Waiter",
};

// Same short reference the POS shows next to an order number (lib/posOrders.ts#orderRefLabel).
export function shortRef(id: string): string {
  return id.slice(0, 8).toUpperCase();
}

function words(value: string): string {
  return value.replace(/_/g, " ").toLowerCase();
}

// "BOOKING_STATUS_CHANGED" -> "Booking status changed".
export function describeEnumValue(value: string): string {
  const lower = words(value);
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

// Booking statuses inside an audit sentence read as the labels staff see ("from NEW to CONFIRMED" -> "from Tentative to
// Confirmed"; "status CONFIRMED" at creation). Entries are immutable and keep the raw values - only the reading changes.
const STATUS_WORD: Record<string, string> = { NEW: "Tentative", CONFIRMED: "Confirmed", PAID: "Room paid", CANCELLED: "Cancelled" };
function statusWord(raw: string): string {
  return STATUS_WORD[raw.toUpperCase()] ?? raw;
}

function statusLabels(summary: string): string {
  return summary
    .replace(/(status changed from )(\w+)( to )(\w+)/gi, (_match, lead, oldStatus, mid, newStatus) => `${lead}${statusWord(oldStatus)}${mid}${statusWord(newStatus)}`)
    .replace(/(; status )(NEW|CONFIRMED)\b/g, (_match, lead, status) => `${lead}${statusWord(status)}`);
}

export function humanizeAuditSummary(summary: string): string {
  return statusLabels(summary)
    .replace(UUID, (id) => shortRef(id))
    .replace(MULTI_WORD_ENUM, (token) => words(token))
    .replace(SINGLE_WORD, (token) => (SINGLE_WORD_ENUMS.has(token) ? words(token) : token));
}

// Who did it: "Anna (Manager)", or "System" for a scheduled sweep (actorRole null - see the
// backend's AuditLogService#recordSystemAction), whose sentinel email means nothing to a reader.
export function describeAuditActor(actorEmail: string, actorRole: Role | null): string {
  return actorRole === null ? "System" : `${actorEmail} (${ROLE_LABELS[actorRole] ?? describeEnumValue(actorRole)})`;
}

// "Order 41F8B768" for the record an entry is about.
export function describeAuditEntity(entityType: string, entityId: string): string {
  return `${describeEnumValue(entityType)} ${IS_UUID.test(entityId) ? shortRef(entityId) : entityId}`;
}

// One audit entry as a person reads it - the sentence and who did it. The booking page's History and the
// calendar panel's both render through this, so the page can no longer show "status CONFIRMED" / "from NEW to
// PAID" where the panel shows "Confirmed" / "from Tentative to Room paid".
export function describeAuditEntry(entry: { summary: string; actorEmail: string; actorRole: Role | null }): { text: string; actor: string } {
  return { text: humanizeAuditSummary(entry.summary), actor: describeAuditActor(entry.actorEmail, entry.actorRole) };
}
