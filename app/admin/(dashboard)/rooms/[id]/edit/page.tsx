import { notFound } from "next/navigation";
import { backendJson } from "@/lib/backendServer";
import { BackendError } from "@/lib/backend";
import { getSessionUser, hasRoleAtLeast } from "@/lib/rbac";
import RoomForm from "@/components/admin/RoomForm";
import RoomImageUploader from "@/components/admin/RoomImageUploader";
import RoomUnitManager from "@/components/admin/RoomUnitManager";
import type { Room, RoomUnit } from "@/lib/types";

export default async function EditRoomPage({ params }: { params: { id: string } }) {
  let room: Room;
  try {
    room = await backendJson<Room>(`/rooms/${params.id}`, { auth: true });
  } catch (e) {
    if (e instanceof BackendError && e.status === 404) notFound();
    throw e;
  }

  const user = await getSessionUser();
  const canManageUnits = !!user && hasRoleAtLeast(user.role, "MANAGER");
  // GET /room-units is MANAGER+ with no lower-privilege read (per
  // openapi.yaml) — skip the call entirely rather than let it 403.
  const units = canManageUnits ? await backendJson<RoomUnit[]>(`/room-units?roomId=${room.id}`, { auth: true }) : [];

  return (
    <div>
      <p className="eyebrow text-sea mb-2">Inventory</p>
      <h1 className="font-display italic text-3xl mb-8">{room.name}</h1>

      <RoomForm
        mode="edit"
        roomId={room.id}
        activeUnitCount={room.activeUnitCount}
        initialValues={{
          name: room.name,
          description: room.description,
          capacity: room.capacity,
          basePrice: Number(room.basePrice),
        }}
      />

      <div className="mt-10 pt-10 border-t border-cream/10">
        <RoomImageUploader roomId={room.id} images={room.images} />
      </div>

      <div className="mt-10 pt-10 border-t border-cream/10">
        <p className="eyebrow text-cream/50 mb-3">Rooms</p>
        <RoomUnitManager roomId={room.id} initialUnits={units} canManage={canManageUnits} />
      </div>
    </div>
  );
}
