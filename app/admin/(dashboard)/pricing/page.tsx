import { redirect } from "next/navigation";

// Pricing and Availability were merged into one room type x date table at /admin/rates. This route
// stays so staff bookmarks and the manual's old links still land somewhere - on the Rates tab.
export default function AdminPricingPage({ searchParams }: { searchParams: { month?: string } }) {
  const params = new URLSearchParams({ view: "rates" });
  if (searchParams.month) params.set("month", searchParams.month);
  redirect(`/admin/rates?${params.toString()}`);
}
