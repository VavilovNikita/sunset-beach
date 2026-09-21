import GuestOrderClient from "@/components/GuestOrderClient";

// No auth guard, no staff layout (see app/order/layout.tsx) - a guest scanning a table's QR code
// is anonymous and unauthenticated by design (see the backend's PublicOrderingApi). `token` is
// the entire access control; there is nothing here to check server-side before rendering, so
// this page hands straight off to the client component, which does its own fetching/polling.
export default function GuestOrderPage({
  params,
  searchParams,
}: {
  params: { orderId: string };
  searchParams: { t?: string };
}) {
  return <GuestOrderClient orderId={params.orderId} token={searchParams.t ?? ""} />;
}
