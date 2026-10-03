import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import OrderTicket from "@/components/OrderTicket";
import type { MenuItem, Order, OrderStatus, Zone } from "@/lib/posTypes";

// The ticket only needs a router to replace a draft's URL once its first item creates the order.
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: () => {}, push: () => {} }) }));

function menuItem(id: string, name: string, category: string, department: MenuItem["department"]): MenuItem {
  return { id, name, description: "", category, department, price: "100.00", isAvailable: true, durationMinutes: null, createdAt: "2026-10-01T00:00:00Z" };
}

const MENU = [
  menuItem("m1", "Pad Thai", "Mains", "KITCHEN"),
  menuItem("m2", "Mojito", "Cocktails", "BAR"),
  menuItem("m3", "Thai massage", "Massage", "SPA"),
];

function order(status: OrderStatus): Order {
  return {
    id: "o1",
    tableId: "t1",
    bookingId: null,
    guestName: null,
    status,
    openedByUserId: "u1",
    openedByEmail: "waiter@example.com",
    total: "200.00",
    note: null,
    items: [
      { id: "i1", orderId: "o1", menuItemId: "m1", quantity: 2, unitPrice: "100.00", note: null, createdAt: "2026-10-01T00:00:00Z", sentAt: null },
    ],
    createdAt: "2026-10-01T00:00:00Z",
    updatedAt: "2026-10-01T00:00:00Z",
    paymentMethod: null,
    guestAccessToken: null,
    number: 42,
    closedAt: null,
    spaAppointmentId: null,
    voids: [],
  };
}

const SURFACES = [
  { name: "desktop till", basePath: "/admin/pos" as const, actor: null },
  { name: "phone", basePath: "/pos" as const, actor: { email: "cashier@example.com", role: "CASHIER" as const } },
];

function render(surface: (typeof SURFACES)[number], o: Order | null, tableZone: Zone | null = "RESTAURANT", canVoidSentItems = false) {
  return renderToStaticMarkup(
    <OrderTicket
      initialOrder={o}
      menu={MENU}
      tableZone={tableZone}
      canManagePayments
      canVoidSentItems={canVoidSentItems}
      basePath={surface.basePath}
      actor={surface.actor}
    />
  );
}

function sentOrder(): Order {
  const o = order("SENT");
  return { ...o, items: o.items.map((i) => ({ ...i, sentAt: "2026-10-01T00:05:00Z" })) };
}

describe.each(SURFACES)("OrderTicket on the $name", (surface) => {
  it("offers search, category tabs and a +/- stepper on an open order", () => {
    const html = render(surface, order("OPEN"));
    expect(html).toContain('placeholder="Search menu…"');
    expect(html).toContain(">Mains</button>");
    expect(html).toContain('aria-label="One more"');
    expect(html).toContain('aria-label="One fewer"');
    // One markup for every width - the wide arrangement is only responsive classes on it.
    expect(html).toContain("xl:grid-cols-[minmax(0,1fr)_380px]");
  });

  it("never lists a spa treatment on a restaurant table, and has no pre-selected item", () => {
    const html = render(surface, order("OPEN"));
    expect(html).toContain("Pad Thai");
    expect(html).not.toContain("Thai massage");
    expect(html).not.toContain(">Spa</button>");
    expect(html).not.toContain("<select");
  });

  it("groups treatments under their own Spa tab on a table-less ticket", () => {
    const html = render(surface, { ...order("OPEN"), tableId: null }, null);
    expect(html).toContain(">Spa</button>");
  });

  it("starts a draft with the same picker and writes nothing until an item is tapped", () => {
    const html = render(surface, null);
    expect(html).toContain("the order starts when you add the first one");
    expect(html).toContain('placeholder="Search menu…"');
    expect(html).not.toContain("Send to kitchen");
  });

  it("keeps Send in place, disabled, once the order is sent", () => {
    const html = render(surface, order("SENT"));
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>Sent ✓<\/button>/);
    expect(html).toContain(">Cash</button>");
  });

  it("drops the stepper and the menu once the order is paid", () => {
    const html = render(surface, { ...order("PAID"), paymentMethod: "CASH" });
    expect(html).not.toContain('aria-label="One more"');
    expect(html).not.toContain('placeholder="Search menu…"');
    expect(html).toContain("Paid via Cash");
  });

  it("shows the receipt number next to the id reference", () => {
    const html = render(surface, order("OPEN"));
    expect(html).toContain("#42");
    expect(html).toContain("ref O1");
  });

  it("offers Void on a sent line only to a manager", () => {
    expect(render(surface, sentOrder(), "RESTAURANT", true)).toContain(">Void</button>");
    expect(render(surface, sentOrder(), "RESTAURANT", false)).not.toContain(">Void</button>");
    // An unsent line is edited with the stepper, never voided.
    expect(render(surface, order("OPEN"), "RESTAURANT", true)).not.toContain(">Void</button>");
  });

  it("lists voided items with the reason, outside the bill", () => {
    const html = render(surface, {
      ...sentOrder(),
      voids: [
        {
          id: "v1",
          menuItemId: "m2",
          quantity: 1,
          unitPrice: "100.00",
          note: null,
          sentAt: "2026-10-01T00:05:00Z",
          reason: "Guest sent it back",
          voidedByUserId: "u9",
          voidedByEmail: "manager@example.com",
          voidedAt: "2026-10-01T01:00:00Z",
        },
      ],
    });
    expect(html).toContain("Voided after sending");
    expect(html).toContain("Guest sent it back");
    expect(html).toContain("manager@example.com");
  });
});
