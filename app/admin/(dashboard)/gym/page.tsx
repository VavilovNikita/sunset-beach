import { backendJson } from "@/lib/backendServer";
import { requireRoleAtLeast } from "@/lib/rbac";
import GymBoard from "@/components/admin/GymBoard";
import type { GymDeviceList } from "@/lib/types";

// GET /gym/devices is CASHIER+ on the backend (switching a fan is front-desk work). Opening the page
// reads the relays' state once (the backend caches it for ~30 s); nothing refreshes it afterwards -
// the Tuya trial has a monthly call quota, so the board has a button instead of a timer.
export default async function AdminGymPage() {
  const user = await requireRoleAtLeast("CASHIER");

  const list = await backendJson<GymDeviceList>("/gym/devices", { auth: true });

  return (
    <div>
      <p className="eyebrow text-sea mb-2">Front desk</p>
      <h1 className="font-display italic text-3xl mb-4">Gym</h1>
      <p className="text-sm text-cream/60 mb-6 max-w-2xl">
        Вентиляторы показывают настоящее состояние. У кондиционеров настоящее состояние узнать нельзя — для них показана последняя команда, отправленная из этой
        системы. Страница не обновляется сама: нажмите «Обновить».
      </p>
      <GymBoard initial={list} isAdmin={user.role === "ADMIN"} />
    </div>
  );
}
