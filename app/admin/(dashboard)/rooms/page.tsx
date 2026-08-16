import Link from "next/link";
import Image from "next/image";
import { backendJson } from "@/lib/backendServer";
import { ADMIN_API_URL, resolveImageUrl } from "@/lib/backend";
import DeleteButton from "@/components/admin/DeleteButton";
import type { Room } from "@/lib/types";

export default async function AdminRoomsPage() {
  const rooms = await backendJson<Room[]>("/rooms", { auth: true });

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <p className="eyebrow text-sea mb-2">Inventory</p>
          <h1 className="font-display italic text-3xl">Rooms</h1>
        </div>
        <Link
          href="/admin/rooms/new"
          className="rounded-full bg-coral hover:bg-coraldeep transition-colors px-5 py-2.5 text-sm font-medium"
        >
          New room
        </Link>
      </div>

      <div className="space-y-4">
        {rooms.map((room) => (
          <div
            key={room.id}
            className="flex items-center gap-4 bg-ink2/40 border border-cream/10 rounded-xl p-4"
          >
            <div className="relative w-24 h-16 rounded-lg overflow-hidden shrink-0 bg-ink3">
              {room.images[0] && (
                <Image
                  src={resolveImageUrl(room.images[0])!}
                  alt=""
                  fill
                  sizes="96px"
                  className="object-cover"
                  unoptimized={room.images[0].startsWith("/uploads/")}
                />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-display text-lg truncate">{room.name}</p>
              <p className="text-sm text-cream/60">
                {room.capacity} guests · {room.quantity} {room.quantity === 1 ? "room" : "rooms"} · ฿
                {Number(room.basePrice).toLocaleString("en-US")}/night base
              </p>
            </div>
            <Link href={`/admin/rooms/${room.id}/edit`} className="text-sm text-sea hover:text-coral transition-colors">
              Edit
            </Link>
            <DeleteButton
              url={`${ADMIN_API_URL}/rooms/${room.id}`}
              confirmText={`Delete "${room.name}"? This can't be undone.`}
            />
          </div>
        ))}
        {rooms.length === 0 && <p className="text-cream/50 text-sm">No rooms yet.</p>}
      </div>
    </div>
  );
}
