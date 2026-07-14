import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import RoomForm from "@/components/admin/RoomForm";
import RoomImageUploader from "@/components/admin/RoomImageUploader";

export default async function EditRoomPage({ params }: { params: { id: string } }) {
  const room = await prisma.room.findUnique({ where: { id: params.id } });
  if (!room) notFound();

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
          basePrice: Number(room.basePrice),
        }}
      />

      <div className="mt-10 pt-10 border-t border-cream/10">
        <RoomImageUploader roomId={room.id} images={room.images} />
      </div>
    </div>
  );
}
