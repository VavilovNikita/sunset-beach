// Mirrors the backend's PublicOrderingApi schemas (GuestOrderView/GuestOrderItem in openapi.yaml)
// — the guest-facing projection of Order/OrderItem, never the staff shapes in lib/posTypes.ts.
// Deliberately its own file: the backend keeps these on a separate tag/generated interface
// (PublicOrderingApi, not the staff OrdersApi) precisely so the two never get conflated, and the
// frontend types mirror that split.
import type { OrderStatus } from "@/lib/posTypes";

export type GuestOrderItem = {
  name: string;
  quantity: number;
  note: string | null;
  unitPrice: string;
};

export type GuestOrderView = {
  id: string;
  status: OrderStatus;
  locationLabel: string;
  items: GuestOrderItem[];
  total: string;
};
