import { unzipSync, strFromU8 } from "fflate";

import type { CsvImportRow } from "@/lib/products/repository";
import { ValidationError } from "@/lib/products/validation";

export type ParsedTable = {
  headers: string[];
  rows: string[][];
  rowNumbers: number[];
};

const REQUIRED_HEADER_ALIASES = {
  sku: ["SKU"],
  title: ["Item Name", "Title"],
} as const;

function hasAnyHeader(headers: string[], candidates: readonly string[]): boolean {
  return candidates.some((candidate) => headers.includes(candidate));
}

function hasRequiredHeaders(headers: string[]): boolean {
  return (
    hasAnyHeader(headers, REQUIRED_HEADER_ALIASES.sku) &&
    hasAnyHeader(headers, REQUIRED_HEADER_ALIASES.title)
  );
}

function parseCsvLine(line: string): string[] {
  const values: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      values.push(current.trim());
      current = "";
      continue;
    }

    current += char;
  }

  values.push(current.trim());
  return values;
}

function xmlDecode(text: string): string {
  const decoded = text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#xA;/gi, "\n");

  return decoded
    .replace(/&#(\d+);/g, (_match, code) => String.fromCharCode(Number.parseInt(code, 10)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_match, code) =>
      String.fromCharCode(Number.parseInt(code, 16)),
    );
}

function getCellColumnIndex(cellRef: string | undefined): number {
  if (!cellRef) {
    return 0;
  }

  const letters = cellRef.match(/[A-Z]+/)?.[0] ?? "A";
  let result = 0;

  for (let i = 0; i < letters.length; i += 1) {
    result = result * 26 + (letters.charCodeAt(i) - 64);
  }

  return result - 1;
}

function parseSharedStrings(xml: string): string[] {
  const out: string[] = [];
  const siRegex = /<si[^>]*>([\s\S]*?)<\/si>/g;
  let siMatch: RegExpExecArray | null = siRegex.exec(xml);

  while (siMatch) {
    const siBody = siMatch[1];
    const tRegex = /<t[^>]*>([\s\S]*?)<\/t>/g;
    let tMatch: RegExpExecArray | null = tRegex.exec(siBody);
    let text = "";

    while (tMatch) {
      text += xmlDecode(tMatch[1]);
      tMatch = tRegex.exec(siBody);
    }

    out.push(text);
    siMatch = siRegex.exec(xml);
  }

  return out;
}

function parseWorkbookRelationships(xml: string): Record<string, string> {
  const map: Record<string, string> = {};
  const relRegex = /<Relationship\s+([^>]*)\/>/g;
  let match: RegExpExecArray | null = relRegex.exec(xml);

  while (match) {
    const attrs = match[1];
    const id = attrs.match(/\bId="([^"]+)"/)?.[1];
    const target = attrs.match(/\bTarget="([^"]+)"/)?.[1];

    if (id && target) {
      map[id] = target;
    }

    match = relRegex.exec(xml);
  }

  return map;
}

function parseWorkbookSheets(xml: string): Array<{ name: string; rid: string }> {
  const out: Array<{ name: string; rid: string }> = [];
  const sheetRegex = /<sheet\s+[^>]*name="([^"]+)"[^>]*r:id="([^"]+)"[^>]*\/>/g;
  let match: RegExpExecArray | null = sheetRegex.exec(xml);

  while (match) {
    out.push({ name: xmlDecode(match[1]), rid: match[2] });
    match = sheetRegex.exec(xml);
  }

  return out;
}

function parseSheetRows(sheetXml: string, sharedStrings: string[]): Array<{ rowNumber: number; values: string[] }> {
  const rows: Array<{ rowNumber: number; values: string[] }> = [];
  const rowRegex = /<row\s+[^>]*r="(\d+)"[^>]*>([\s\S]*?)<\/row>/g;
  let rowMatch: RegExpExecArray | null = rowRegex.exec(sheetXml);

  while (rowMatch) {
    const rowNumber = Number.parseInt(rowMatch[1], 10);
    const rowBody = rowMatch[2];
    const valuesByIndex = new Map<number, string>();

    const cellRegex = /<c\s+([^>]*)>([\s\S]*?)<\/c>/g;
    let cellMatch: RegExpExecArray | null = cellRegex.exec(rowBody);

    while (cellMatch) {
      const attrs = cellMatch[1];
      const cellBody = cellMatch[2];

      const ref = attrs.match(/r="([A-Z]+\d+)"/)?.[1];
      const type = attrs.match(/t="([^"]+)"/)?.[1] ?? "n";
      const colIndex = getCellColumnIndex(ref);

      let value = "";
      const vTag = cellBody.match(/<v>([\s\S]*?)<\/v>/)?.[1];

      if (type === "s" && vTag) {
        const sharedIndex = Number.parseInt(vTag, 10);
        value = sharedStrings[sharedIndex] ?? "";
      } else if (type === "inlineStr") {
        const tTag = cellBody.match(/<t[^>]*>([\s\S]*?)<\/t>/)?.[1];
        value = tTag ? xmlDecode(tTag) : "";
      } else if (vTag) {
        value = xmlDecode(vTag);
      }

      valuesByIndex.set(colIndex, value.trim());
      cellMatch = cellRegex.exec(rowBody);
    }

    const maxIndex = Math.max(-1, ...valuesByIndex.keys());
    const values: string[] = [];

    for (let i = 0; i <= maxIndex; i += 1) {
      values.push(valuesByIndex.get(i) ?? "");
    }

    rows.push({ rowNumber, values });
    rowMatch = rowRegex.exec(sheetXml);
  }

  return rows;
}

function pickHeaderRow(rows: Array<{ rowNumber: number; values: string[] }>): {
  headerRowIndex: number;
  headers: string[];
} {
  for (let i = 0; i < rows.length; i += 1) {
    const headers = rows[i].values.map((v) => v.trim());
    if (hasRequiredHeaders(headers)) {
      return { headerRowIndex: i, headers };
    }
  }

  throw new ValidationError("Unable to find a valid header row (expected SKU and Item Name/Title)");
}

export function parseCsv(text: string): ParsedTable {
  const normalized = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const lines = normalized.split("\n");
  const parsedRows = lines
    .map((line, index) => ({ rowNumber: index + 1, values: parseCsvLine(line) }))
    .filter((row) => row.values.some((value) => value.trim().length > 0));

  if (parsedRows.length < 2) {
    throw new ValidationError("CSV must include a header row and at least one data row");
  }

  const { headerRowIndex, headers } = pickHeaderRow(parsedRows);
  const dataRows = parsedRows.slice(headerRowIndex + 1);
  const rows = dataRows.map((row) => row.values);
  const rowNumbers = dataRows.map((row) => row.rowNumber);

  if (rows.length === 0) {
    throw new ValidationError("No data rows found after header row");
  }

  return { headers, rows, rowNumbers };
}

export function parseXlsx(buffer: ArrayBuffer): ParsedTable {
  let files: Record<string, Uint8Array>;
  try {
    files = unzipSync(new Uint8Array(buffer));
  } catch {
    throw new ValidationError("Invalid XLSX file: unable to read workbook");
  }

  const workbookXml = files["xl/workbook.xml"];
  const relationshipsXml = files["xl/_rels/workbook.xml.rels"];

  if (!workbookXml || !relationshipsXml) {
    throw new ValidationError("Invalid XLSX file: missing workbook metadata");
  }

  const workbook = strFromU8(workbookXml);
  const rels = parseWorkbookRelationships(strFromU8(relationshipsXml));
  const sheets = parseWorkbookSheets(workbook);

  if (sheets.length === 0) {
    throw new ValidationError("XLSX contains no sheets");
  }

  const preferred = sheets.find((sheet) => sheet.name === "Combined Inventory") ?? sheets[0];
  const target = rels[preferred.rid];

  if (!target) {
    throw new ValidationError("Invalid XLSX file: missing sheet relationship");
  }

  const normalizedTarget = target.replace(/^\.\.\//, "").replace(/^\/+/, "");
  const sheetPath = normalizedTarget.startsWith("xl/") ? normalizedTarget : `xl/${normalizedTarget}`;
  const sheetXmlBytes = files[sheetPath];

  if (!sheetXmlBytes) {
    throw new ValidationError(`Sheet not found in XLSX: ${preferred.name}`);
  }

  const sharedStringsXml = files["xl/sharedStrings.xml"];
  const sharedStrings = sharedStringsXml ? parseSharedStrings(strFromU8(sharedStringsXml)) : [];
  const parsedRows = parseSheetRows(strFromU8(sheetXmlBytes), sharedStrings);

  if (parsedRows.length === 0) {
    throw new ValidationError("Selected sheet has no rows");
  }

  const { headerRowIndex, headers } = pickHeaderRow(parsedRows);
  const dataRows = parsedRows.slice(headerRowIndex + 1);

  const rows = dataRows
    .map((row) => row.values)
    .filter((values) => values.some((value) => value.trim().length > 0));

  const rowNumbers = dataRows
    .filter((row) => row.values.some((value) => value.trim().length > 0))
    .map((row) => row.rowNumber);

  if (rows.length === 0) {
    throw new ValidationError("No data rows found after header row");
  }

  return { headers, rows, rowNumbers };
}

function getRecordValue(record: Record<string, string>, keys: string[]): string | undefined {
  for (const key of keys) {
    if (key in record && record[key].trim().length > 0) {
      return record[key];
    }
  }

  return undefined;
}

function parseOptionalString(value: string | undefined): string | null {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function parseOptionalWeight(value: string | undefined): number | null {
  const raw = parseOptionalString(value);
  if (!raw) {
    return null;
  }

  const lower = raw.toLowerCase();
  const numericText = lower.replace(/[^0-9.\-]/g, "");
  const parsed = Number.parseFloat(numericText);

  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new ValidationError(`Invalid weight value: ${raw}`);
  }

  if (/\bkg\b/.test(lower)) {
    return Number.parseFloat((parsed * 2.20462).toFixed(2));
  }

  if (/\bg\b/.test(lower) && !/\bkg\b/.test(lower)) {
    return Number.parseFloat((parsed / 453.592).toFixed(2));
  }

  if (/\blb\b|\blbs\b|pounds?/.test(lower) || !/[a-z]/.test(lower)) {
    return parsed;
  }

  throw new ValidationError(`Unsupported weight unit in value: ${raw}`);
}

function parsePriceTokenToCents(token: string): number {
  const normalized = token.trim().toLowerCase();

  if (!normalized || /^(tbd|n\/a|na|null|none|-)$/.test(normalized)) {
    throw new ValidationError(`Invalid price value: ${token}`);
  }

  if (normalized.includes("=")) {
    throw new ValidationError(`Formula values are not supported in price fields: ${token}`);
  }

  const numericText = normalized.replace(/,/g, "").replace(/[^0-9.]/g, "").trim();
  const parsed = Number.parseFloat(numericText);

  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new ValidationError(`Invalid price value: ${token}`);
  }

  return Math.round(parsed * 100);
}

function parseSuggestedRangeFromRecord(record: Record<string, string>): {
  low: number | null;
  high: number | null;
} {
  const suggestedRaw = getRecordValue(record, ["Suggested Price Range"]);

  if (suggestedRaw) {
    const normalized = suggestedRaw.replace(/\u2013|\u2014/g, "-").replace(/\bto\b/gi, "-");
    const parts = normalized
      .split("-")
      .map((part) => part.trim())
      .filter((part) => part.length > 0);

    if (parts.length === 1) {
      const cents = parsePriceTokenToCents(parts[0]);
      return { low: cents, high: cents };
    }

    if (parts.length === 2) {
      const low = parsePriceTokenToCents(parts[0]);
      const high = parsePriceTokenToCents(parts[1]);

      if (high < low) {
        throw new ValidationError(`Invalid suggested price range: ${suggestedRaw}`);
      }

      return { low, high };
    }

    throw new ValidationError(`Invalid suggested price range: ${suggestedRaw}`);
  }

  const minRaw = getRecordValue(record, ["Price Min"]);
  const maxRaw = getRecordValue(record, ["Price Max"]);

  const low = minRaw ? parsePriceTokenToCents(minRaw) : null;
  const high = maxRaw ? parsePriceTokenToCents(maxRaw) : null;

  if (low === null && high === null) {
    throw new ValidationError("Price Min/Price Max or Suggested Price Range is required");
  }

  if (low !== null && high !== null && high < low) {
    throw new ValidationError("Price Max must be greater than or equal to Price Min");
  }

  return { low, high };
}

function normalizeDimensions(value: string | undefined): string | null {
  const raw = parseOptionalString(value);
  if (!raw) {
    return null;
  }

  const lower = raw.toLowerCase();
  const hasCm = /\bcm\b/.test(lower);
  const hasInches = /\"|\bin\b|\binches?\b/.test(lower);

  if (hasCm && hasInches) {
    throw new ValidationError(`Dimensions must use either cm or inches, not both: ${raw}`);
  }

  if (!hasCm) {
    return raw;
  }

  const numbers = [...raw.matchAll(/(\d+(?:\.\d+)?)/g)].map((match) => Number.parseFloat(match[1]));
  if (numbers.length === 0) {
    throw new ValidationError(`Invalid dimensions value: ${raw}`);
  }

  const inches = numbers.map((num) => Number.parseFloat((num / 2.54).toFixed(1)));
  return `${inches.join(" x ")} in`;
}

export function mapCsvRowToProduct(headers: string[], row: string[]): CsvImportRow {
  const record = headers.reduce<Record<string, string>>((acc, header, index) => {
    acc[header.trim()] = row[index] ?? "";
    return acc;
  }, {});

  const sku = parseOptionalString(getRecordValue(record, ["SKU"]));
  const title = parseOptionalString(getRecordValue(record, ["Title", "Item Name"]));

  if (!sku) {
    throw new ValidationError("SKU is required");
  }

  if (!title) {
    throw new ValidationError("Title/Item Name is required");
  }

  const suggested = parseSuggestedRangeFromRecord(record);

  return {
    sku,
    category: parseOptionalString(getRecordValue(record, ["Category", "Product Category"])),
    name: title,
    conditionNote: parseOptionalString(getRecordValue(record, ["Condition"])),
    dimensions: normalizeDimensions(getRecordValue(record, ["Dimensions", "Measurements"])),
    weightLbs: parseOptionalWeight(getRecordValue(record, ["Weight"])),
    suggestedPriceLowCents: suggested.low,
    suggestedPriceHighCents: suggested.high,
    description: parseOptionalString(
      getRecordValue(record, [
        "Description/Blurb",
        "Full Product Description (for listing)",
        "Item Description",
      ]),
    ),
  };
}
