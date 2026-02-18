import { NextResponse } from "next/server";

import { AdminAuthError, requireAdmin } from "@/lib/auth/admin";
import { mapCsvRowToProduct, parseCsv, parseXlsx } from "@/lib/products/csv";
import { upsertDraftProductFromCsv } from "@/lib/products/repository";
import { ValidationError } from "@/lib/products/validation";

type ImportErrorRow = {
  rowNumber: number;
  reason: string;
};

const MAX_IMPORT_FILE_BYTES = 10 * 1024 * 1024;
const MAX_IMPORT_ROWS = 2000;

export async function POST(request: Request) {
  try {
    requireAdmin(request);

    const formData = await request.formData();
    const fileValue = formData.get("file");

    if (!(fileValue instanceof File)) {
      throw new ValidationError("file is required");
    }

    const filename = fileValue.name.toLowerCase();
    const isCsv = filename.endsWith(".csv");
    const isXlsx = filename.endsWith(".xlsx");

    if (filename.endsWith(".xls")) {
      throw new ValidationError("Legacy .xls files are not supported. Please save as .xlsx or .csv.");
    }

    if (!isCsv && !isXlsx) {
      throw new ValidationError("Unsupported file type. Upload .csv or .xlsx.");
    }

    if (fileValue.size > MAX_IMPORT_FILE_BYTES) {
      throw new ValidationError("File too large. Maximum supported size is 10MB.");
    }

    let parsed;
    if (isXlsx) {
      const arrayBuffer = await fileValue.arrayBuffer();
      const signature = new Uint8Array(arrayBuffer.slice(0, 4));
      const isZipSignature =
        signature.length >= 2 && signature[0] === 0x50 && signature[1] === 0x4b;

      if (!isZipSignature) {
        throw new ValidationError("File extension is .xlsx but content is not a valid Excel workbook.");
      }

      parsed = parseXlsx(arrayBuffer);
    } else {
      parsed = parseCsv(await fileValue.text());
    }

    const { headers, rows, rowNumbers } = parsed;

    if (rows.length > MAX_IMPORT_ROWS) {
      throw new ValidationError(`Too many rows (${rows.length}). Maximum supported rows: ${MAX_IMPORT_ROWS}.`);
    }

    let createdCount = 0;
    let updatedCount = 0;
    const errorRows: ImportErrorRow[] = [];
    const seenSkus = new Map<string, number>();

    for (let index = 0; index < rows.length; index += 1) {
      const rowNumber = rowNumbers[index] ?? index + 2;
      const row = rows[index];

      try {
        const mapped = mapCsvRowToProduct(headers, row);
        const normalizedSku = mapped.sku.trim().toLowerCase();

        if (seenSkus.has(normalizedSku)) {
          const firstRow = seenSkus.get(normalizedSku);
          errorRows.push({
            rowNumber,
            reason: `Duplicate SKU in file (${mapped.sku}). First seen at row ${firstRow}.`,
          });
          continue;
        }

        seenSkus.set(normalizedSku, rowNumber);

        const result = await upsertDraftProductFromCsv(mapped);

        if (result.inserted) {
          createdCount += 1;
        } else {
          updatedCount += 1;
        }
      } catch (error) {
        errorRows.push({
          rowNumber,
          reason: error instanceof Error ? error.message : "unknown error",
        });
      }
    }

    return NextResponse.json({
      totalRows: rows.length,
      createdCount,
      updatedCount,
      skippedCount: errorRows.length,
      errorRows,
      strategy: "upsert by SKU; on conflict updates only empty fields on existing records",
    });
  } catch (error) {
    if (error instanceof AdminAuthError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (error instanceof ValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    console.error("POST /api/admin/products/import-csv failed", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
