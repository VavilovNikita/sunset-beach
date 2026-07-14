import { z } from "zod";

export const roomSchema = z.object({
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().min(10),
  capacity: z.coerce.number().int().min(1).max(20),
  basePrice: z.coerce.number().positive(),
});

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD");

export const priceRangeSchema = z
  .object({
    from: isoDate,
    to: isoDate,
    price: z.coerce.number().positive(),
  })
  .refine((v) => v.from <= v.to, { message: "from must be on or before to", path: ["to"] });

export const availabilityRangeSchema = z
  .object({
    from: isoDate,
    to: isoDate,
    isBlocked: z.boolean(),
  })
  .refine((v) => v.from <= v.to, { message: "from must be on or before to", path: ["to"] });

export const bookingCreateSchema = z
  .object({
    roomId: z.string().min(1),
    guestName: z.string().trim().min(2).max(120),
    guestEmail: z.string().trim().email(),
    guestPhone: z.string().trim().min(5).max(40),
    checkIn: isoDate,
    checkOut: isoDate,
  })
  .refine((v) => v.checkIn < v.checkOut, { message: "checkIn must be before checkOut", path: ["checkOut"] });

export const bookingStatusSchema = z.object({
  status: z.enum(["NEW", "CONFIRMED", "PAID", "CANCELLED"]),
  paymentNote: z.string().trim().max(500).optional().nullable(),
});

export const userCreateSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(8).max(200),
  role: z.enum(["ADMIN", "MANAGER"]).default("MANAGER"),
});

export const userRoleUpdateSchema = z.object({
  role: z.enum(["ADMIN", "MANAGER"]),
});
