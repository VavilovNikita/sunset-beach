import { backendJson } from "@/lib/backendServer";
import { requireRoleAtLeastOrFunction } from "@/lib/rbac";
import ShiftRequestsBoard from "@/components/admin/ShiftRequestsBoard";
import { defaultRequestFilters, requestsQueryString } from "@/lib/shiftRequests";
import type { ShiftChangeRequest, ShiftRequestDeciders } from "@/lib/types";

// GET /shift-change-requests and /deciders are MANAGER+ or the HR function on the backend (a read); deciding is
// the HR director's (or an administrator's while nobody holds HR / they are away) - the server says per request
// whether this caller may (`callerMayDecide`), and the board shows the buttons only for those. A role below
// MANAGER without HR is sent away here as well as on the server: a hidden link is not access control.
export default async function ShiftRequestsPage({ searchParams }: { searchParams: { highlight?: string; status?: string } }) {
  const user = await requireRoleAtLeastOrFunction("MANAGER", "HR");

  // A link from the roster grid names one request: open on all statuses so it is found whatever state it is in.
  const highlight = searchParams.highlight?.trim() || undefined;
  const filters = highlight ? { ...defaultRequestFilters(), status: "" as const } : defaultRequestFilters();

  const [requests, deciders] = await Promise.all([
    backendJson<ShiftChangeRequest[]>(`/shift-change-requests?${requestsQueryString(filters)}`, { auth: true }),
    backendJson<ShiftRequestDeciders>("/shift-change-requests/deciders", { auth: true }),
  ]);

  // The HR holder sets their own leave; an administrator sets it for them.
  const canSetLeave = user.role === "ADMIN" || user.functions.includes("HR");

  return (
    <div className="max-w-3xl">
      <div className="mb-8">
        <p className="eyebrow text-sea mb-2">Staff</p>
        <h1 className="font-display italic text-3xl">Shift requests</h1>
        <p className="text-sm text-cream/60 mt-3">
          Employees ask in the staff Telegram bot to move a shift or to take a day off. The HR director decides; approving changes the roster.
        </p>
      </div>
      <ShiftRequestsBoard
        initialRequests={requests}
        initialFilters={filters}
        initialDeciders={deciders}
        canSetLeave={canSetLeave}
        highlightId={highlight}
      />
    </div>
  );
}
