import { backendJson } from "@/lib/backendServer";
import { requireRoleAtLeast } from "@/lib/rbac";
import TodayBoardView from "@/components/admin/TodayBoardView";
import type { TodayBoard } from "@/lib/types";

// CASHIER's post-login landing (see app/admin/login/page.tsx's ROLE_LANDING) - the front desk's
// most-opened screen: who's arriving, who's leaving, who's already here, and what on each row
// still needs doing (no room assigned, room not clean, balance still owed). GET /bookings/today
// is CASHIER+ on the backend, matching every other front-desk read in this app.
export default async function TodayPage() {
  await requireRoleAtLeast("CASHIER", "/admin/pos");

  const board = await backendJson<TodayBoard>("/bookings/today", { auth: true });

  return (
    <div>
      <p className="eyebrow text-sea mb-2">Front desk</p>
      <h1 className="font-display italic text-3xl mb-8">Today</h1>
      <TodayBoardView initialBoard={board} />
    </div>
  );
}
