import { randomUUID } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import path from "path";

import { NextResponse } from "next/server";

import { AdminAuthError, requireAdmin } from "@/lib/auth/admin";
import { isS3Configured, uploadImageToS3 } from "@/lib/storage/s3";

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

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

    const bytes = Buffer.from(await entry.arrayBuffer());

    let imageUrl: string;

    if (isS3Configured()) {
      // ── S3 upload ──────────────────────────────────────────────────────────
      const result = await uploadImageToS3(bytes, fileName, mimeType);

      if (!result.success) {
        console.error("S3 upload failed:", result.error);
        return NextResponse.json({ error: "Image upload failed" }, { status: 500 });
      }

      imageUrl = result.imageUrl;
    } else {
      // ── Local filesystem fallback (dev only) ───────────────────────────────
      // WARNING: local uploads do NOT persist across Vercel deployments.
      // Set AWS_S3_BUCKET, AWS_S3_REGION, AWS_ACCESS_KEY_ID, and
      // AWS_SECRET_ACCESS_KEY to enable S3 in production.
      const uploadsDir = path.join(process.cwd(), "public", "uploads");
      await mkdir(uploadsDir, { recursive: true });
      await writeFile(path.join(uploadsDir, fileName), bytes);
      imageUrl = `/uploads/${fileName}`;
    }

    return NextResponse.json({ imageUrl }, { status: 201 });
  } catch (error) {
    if (error instanceof AdminAuthError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    console.error("POST /api/admin/uploads/images failed", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
