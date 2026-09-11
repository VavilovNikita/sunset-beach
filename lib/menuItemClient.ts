// Shared client-side call for POST/PATCH /menu (components/admin/pos/MenuItemForm.tsx).
import { adminRequest, adminJsonInit } from "@/lib/adminFetch";
import type { MenuDepartment, MenuItem } from "@/lib/posTypes";

export type MenuItemInput = {
  name: string;
  description: string;
  category: string;
  department: Exclude<MenuDepartment, "SPA">;
  price: number;
  isAvailable: boolean;
  durationMinutes: null;
};

export type SaveMenuItemResult = { ok: true; item: MenuItem } | { ok: false; error: string };

export async function createMenuItem(input: MenuItemInput): Promise<SaveMenuItemResult> {
  const result = await adminRequest<MenuItem>("/menu", adminJsonInit("POST", input), "Something went wrong.");
  if (!result.ok) return { ok: false, error: result.error };
  return { ok: true, item: result.data };
}

export async function updateMenuItem(itemId: string, input: MenuItemInput): Promise<SaveMenuItemResult> {
  const result = await adminRequest<MenuItem>(`/menu/${itemId}`, adminJsonInit("PATCH", input), "Something went wrong.");
  if (!result.ok) return { ok: false, error: result.error };
  return { ok: true, item: result.data };
}
