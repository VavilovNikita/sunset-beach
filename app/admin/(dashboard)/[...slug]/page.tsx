import { notFound } from "next/navigation";

// Any /admin/... address no page owns. Without a route to land on, Next shows the root 404 outside the admin frame
// (no sidebar); a catch-all that calls notFound() makes it render this section's not-found.tsx inside it.
export default function AdminUnknownPage() {
  notFound();
}
