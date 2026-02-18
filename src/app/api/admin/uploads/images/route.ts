import { randomUUID } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import path from "path";

import { NextResponse } from "next/server";

import { AdminAuthError, requireAdmin } from "@/lib/auth/admin";

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;

const MIME_EXTENSION: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
  "image/heif": "heif",
};

function sanitizeName(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9.-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 64);
}

export async function POST(request: Request) {
  try {
    requireAdmin(request);

    const formData = await request.formData();
    const entry = formData.get("file");

    if (!(entry instanceof File)) {
      return NextResponse.json({ error: "file is required" }, { status: 400 });
    }

    if (entry.size <= 0) {
      return NextResponse.json({ error: "file is empty" }, { status: 400 });
    }

    if (entry.size > MAX_FILE_SIZE_BYTES) {
      return NextResponse.json({ error: "file too large (max 10MB)" }, { status: 400 });
    }

    const mimeType = entry.type.toLowerCase();
    const extension = MIME_EXTENSION[mimeType];

    if (!extension) {
      return NextResponse.json({ error: "unsupported image type" }, { status: 400 });
    }

    const baseName = sanitizeName(entry.name.replace(/\.[^.]+$/, "")) || "photo";
    const fileName = `${Date.now()}-${baseName}-${randomUUID()}.${extension}`;

    const uploadsDir = path.join(process.cwd(), "public", "uploads");
    await mkdir(uploadsDir, { recursive: true });

    const bytes = Buffer.from(await entry.arrayBuffer());
    await writeFile(path.join(uploadsDir, fileName), bytes);

    return NextResponse.json(
      {
        imageUrl: `/uploads/${fileName}`,
      },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof AdminAuthError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    console.error("POST /api/admin/uploads/images failed", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
