import type { MenuDepartment } from "@/lib/posTypes";

// What the order ticket's send button says, from the departments of the lines it is about to send.
// The backend routes each line by MenuItem.department - kitchen lines to the kitchen printer, bar
// lines to the bar printer, spa treatments to no printer at all (OrderPrintingService#printTickets)
// - so a bar round labelled "Send to kitchen", or a spa ticket promising a kitchen ticket, told
// staff something the system doesn't do.
export type SendLabel = {
  label: string;
  // Shown under the button when sending prints nothing, so nobody waits for a ticket.
  note: string | null;
};

// `departments`: one entry per unsent line; a line whose menu item is unknown counts as KITCHEN,
// the same fallback the backend uses.
export function sendButtonLabel(departments: MenuDepartment[]): SendLabel {
  const kitchen = departments.includes("KITCHEN");
  const bar = departments.includes("BAR");
  if (kitchen && bar) return { label: "Send to kitchen & bar", note: null };
  if (kitchen) return { label: "Send to kitchen", note: null };
  if (bar) return { label: "Send to bar", note: null };
  if (departments.length > 0) return { label: "Confirm treatments", note: "Spa treatments don't print a ticket." };
  return { label: "Send", note: null };
}
