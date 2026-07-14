import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withApiAuth } from "@/lib/rbac";

const MAX_FILE_BYTES = 8 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

function sanitizeFilename(name: string) {
  const ext = path.extname(name).toLowerCase().replace(/[^.\w]/g, "");
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`;
}

export const POST = withApiAuth(async (req, { params }) => {
  const room = await prisma.room.findUnique({ where: { id: params.id } });
  if (!room) return NextResponse.json({ error: "Room not found" }, { status: 404 });

  const formData = await req.formData();
  const files = formData.getAll("files").filter((f): f is File => f instanceof File);
  if (files.length === 0) {
    return NextResponse.json({ error: "No files provided" }, { status: 400 });
  }

  const dir = path.join(process.cwd(), "public", "uploads", "rooms", room.id);
  await mkdir(dir, { recursive: true });

  const newPaths: string[] = [];
  for (const file of files) {
    if (!ALLOWED_TYPES.has(file.type)) {
      return NextResponse.json({ error: `Unsupported file type: ${file.type}` }, { status: 400 });
    }
    if (file.size > MAX_FILE_BYTES) {
      return NextResponse.json({ error: `${file.name} exceeds the 8MB limit` }, { status: 400 });
    }

    const filename = sanitizeFilename(file.name);
    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(path.join(dir, filename), buffer);
    newPaths.push(`/uploads/rooms/${room.id}/${filename}`);
  }

  const updated = await prisma.room.update({
    where: { id: room.id },
    data: { images: { push: newPaths } },
  });

  return NextResponse.json(updated, { status: 201 });
});

export const DELETE = withApiAuth(async (req, { params }) => {
  const { path: imagePath } = await req.json();
  if (typeof imagePath !== "string") {
    return NextResponse.json({ error: "path is required" }, { status: 400 });
  }

  const room = await prisma.room.findUnique({ where: { id: params.id } });
  if (!room) return NextResponse.json({ error: "Room not found" }, { status: 404 });

  const updated = await prisma.room.update({
    where: { id: room.id },
    data: { images: room.images.filter((p) => p !== imagePath) },
  });

  if (imagePath.startsWith(`/uploads/rooms/${room.id}/`)) {
    await unlink(path.join(process.cwd(), "public", imagePath)).catch(() => {});
  }

  return NextResponse.json(updated);
});
