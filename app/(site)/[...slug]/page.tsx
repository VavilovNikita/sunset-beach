import { notFound } from "next/navigation";

// Any address no route owns. This app has no root layout (each section renders its own <html>), and Next refuses a
// root not-found.tsx without one - so the unmatched address is routed into the site's section, where notFound() shows
// the site's own 404 inside its navigation and footer. /admin/... has the same catch-all inside the admin's frame.
export default function SiteUnknownPage() {
  notFound();
}
