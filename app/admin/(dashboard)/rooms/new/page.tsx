import RoomForm from "@/components/admin/RoomForm";

export default function NewRoomPage() {
  return (
    <div>
      <p className="eyebrow text-sea mb-2">Inventory</p>
      <h1 className="font-display italic text-3xl mb-8">New room</h1>
      <RoomForm mode="create" />
    </div>
  );
}
