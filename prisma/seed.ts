import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const ROOMS = [
  {
    id: "room-sunset-jacuzzi-seaview",
    name: "Sunset Jacuzzi SeaView",
    description:
      "Enjoy stunning sunset views in a more spacious setting, with your own private jacuzzi facing the sea.",
    capacity: 2,
    basePrice: 6500,
    photoCount: 3,
    slug: "sunset-jacuzzi-seaview",
  },
  {
    id: "room-garden-jacuzzi-villa",
    name: "Garden Jacuzzi Villa",
    description:
      "Each villa features a refreshing plunge pool and a private sala where you can relax or be pampered with a spa service. The jacuzzi sits beside the shower in your open-air bathroom.",
    capacity: 2,
    basePrice: 8000,
    photoCount: 4,
    slug: "garden-jacuzzi-villa",
  },
  {
    id: "room-beachfront-villa",
    name: "Beachfront Villa",
    description:
      "Simply and heartily decorated, with great comfort and a garden lounge area to watch the sunset and the sea.",
    capacity: 3,
    basePrice: 9500,
    photoCount: 4,
    slug: "beachfront-villa",
  },
  {
    id: "room-beachfront-pool-villa",
    name: "Beachfront Pool Villa",
    description:
      "For the ultimate in luxury, our Beach Front Pool Villas offer over 250 square meters of private space, situated directly on the beach.",
    capacity: 4,
    basePrice: 12500,
    photoCount: 4,
    slug: "beachfront-pool-villa",
  },
];

const RATE_PLAN_DAYS = 90;

function addDays(date: Date, days: number) {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

function startOfTodayUTC() {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

async function main() {
  const adminEmail = process.env.SEED_ADMIN_EMAIL || "admin@sunsetbeach.example";
  const adminPassword = process.env.SEED_ADMIN_PASSWORD || "change-me-after-first-login";
  const passwordHash = await bcrypt.hash(adminPassword, 10);

  await prisma.user.upsert({
    where: { email: adminEmail },
    update: {},
    create: { email: adminEmail, passwordHash, role: "ADMIN" },
  });

  for (const room of ROOMS) {
    const images = Array.from(
      { length: room.photoCount },
      (_, i) => `/images/rooms/${room.slug}/0${i + 1}.jpg`
    );

    await prisma.room.upsert({
      where: { id: room.id },
      update: {
        name: room.name,
        description: room.description,
        capacity: room.capacity,
        basePrice: room.basePrice,
        images,
      },
      create: {
        id: room.id,
        name: room.name,
        description: room.description,
        capacity: room.capacity,
        basePrice: room.basePrice,
        images,
      },
    });

    const today = startOfTodayUTC();
    for (let i = 0; i < RATE_PLAN_DAYS; i++) {
      const date = addDays(today, i);
      await prisma.ratePlan.upsert({
        where: { roomId_date: { roomId: room.id, date } },
        update: {},
        create: { roomId: room.id, date, price: room.basePrice },
      });
    }
  }

  console.log("Seed complete.");
  console.log(`Admin login: ${adminEmail} / ${adminPassword}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
