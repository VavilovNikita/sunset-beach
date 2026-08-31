import { notFound } from "next/navigation";
import { backendJson } from "@/lib/backendServer";
import { BackendError } from "@/lib/backend";
import { requireRoleAtLeast } from "@/lib/rbac";
import RoomForm from "@/components/admin/RoomForm";
import RoomImageUploader from "@/components/admin/RoomImageUploader";
import RoomUnitManager from "@/components/admin/RoomUnitManager";
import type { Room, RoomUnit } from "@/lib/types";

export default async function EditRoomPage({ params }: { params: { id: string } }) {
  // Every write on this page (room fields, photos, physical rooms) is
  // MANAGER+ on the backend — the list page no longer links here for
  // anyone else, this is the direct-URL backstop.
  await requireRoleAtLeast("MANAGER", "/admin/rooms");

  let room: Room;
  try {
    room = await backendJson<Room>(`/rooms/${params.id}`, { auth: true });
  } catch (e) {
    if (e instanceof BackendError && e.status === 404) notFound();
    throw e;
  }

  // GET /room-units is MANAGER+, same floor as this whole page now.
  const units = await backendJson<RoomUnit[]>(`/room-units?roomId=${room.id}`, { auth: true });

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
        <RoomUnitManager roomId={room.id} initialUnits={units} canManage />
      </div>
    </div>
  );
}
