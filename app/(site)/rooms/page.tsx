import RoomsPageContent from "@/components/RoomsPageContent";
import { backendJson } from "@/lib/backendServer";
import type { Room } from "@/lib/types";

export const metadata = { title: "Rooms & Villas — The Sunset Beach Resort & Spa" };

export default async function RoomsPage() {
  const rooms = await backendJson<Room[]>("/public/rooms");
  return <RoomsPageContent rooms={rooms} />;
}
