import { notFound } from "next/navigation";
import { backendJson } from "@/lib/backendServer";
import { BackendError } from "@/lib/backend";
import RoomForm from "@/components/admin/RoomForm";
import RoomImageUploader from "@/components/admin/RoomImageUploader";
import type { Room } from "@/lib/types";

export default async function EditRoomPage({ params }: { params: { id: string } }) {
  let room: Room;
  try {
    room = await backendJson<Room>(`/rooms/${params.id}`, { auth: true });
  } catch (e) {
    if (e instanceof BackendError && e.status === 404) notFound();
    throw e;
  }

  return (
    <div>
      <p className="eyebrow text-sea mb-2">Inventory</p>
      <h1 className="font-display italic text-3xl mb-8">{room.name}</h1>

      <RoomForm
        mode="edit"
        roomId={room.id}
        initialValues={{
          name: room.name,
          description: room.description,
          capacity: room.capacity,
          quantity: room.quantity,
          basePrice: Number(room.basePrice),
        }}
      />

      <div className="mt-10 pt-10 border-t border-cream/10">
        <RoomImageUploader roomId={room.id} images={room.images} />
      </div>
    </div>
  );
}
