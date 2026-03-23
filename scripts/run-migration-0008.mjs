/**
 * Run migration 0008 — expand products table with full inventory fields.
 *
 * Usage (from project root):
 *   node scripts/run-migration-0008.mjs
 */

import { readFileSync } from "fs";
import { createRequire } from "module";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load .env.local
try {
  const env = readFileSync(resolve(__dirname, "../.env.local"), "utf8");
  for (const line of env.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    if (!process.env[key]) process.env[key] = trimmed.slice(eqIdx + 1).trim();
  }
} catch { /* rely on DATABASE_URL in env */ }

const require = createRequire(import.meta.url);
const postgres = require("postgres");

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set. Add it to .env.local or export it.");
  process.exit(1);
}

const sql = postgres(url);

const statements = [
  `ALTER TABLE products
    ADD COLUMN IF NOT EXISTS year_of_purchase       TEXT,
    ADD COLUMN IF NOT EXISTS purchase_date          DATE,
    ADD COLUMN IF NOT EXISTS store_source           TEXT,
    ADD COLUMN IF NOT EXISTS receipt_photo_link     TEXT,
    ADD COLUMN IF NOT EXISTS receipt_documentation  TEXT,
    ADD COLUMN IF NOT EXISTS cog_cents              INTEGER,
    ADD COLUMN IF NOT EXISTS final_sales_price_cents INTEGER,
    ADD COLUMN IF NOT EXISTS shipping_cents         INTEGER,
    ADD COLUMN IF NOT EXISTS taxes_cents            INTEGER,
    ADD COLUMN IF NOT EXISTS image_link             TEXT,
    ADD COLUMN IF NOT EXISTS item_description       TEXT,
    ADD COLUMN IF NOT EXISTS sell_site_location     TEXT,
    ADD COLUMN IF NOT EXISTS measurements           TEXT`,

  `DO $$ BEGIN
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint WHERE conname = 'products_cog_nonnegative'
    ) THEN
      ALTER TABLE products ADD CONSTRAINT products_cog_nonnegative
        CHECK (cog_cents IS NULL OR cog_cents >= 0);
    END IF;
  END $$`,

  `DO $$ BEGIN
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint WHERE conname = 'products_final_sales_price_nonnegative'
    ) THEN
      ALTER TABLE products ADD CONSTRAINT products_final_sales_price_nonnegative
        CHECK (final_sales_price_cents IS NULL OR final_sales_price_cents >= 0);
    END IF;
  END $$`,

  `DO $$ BEGIN
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint WHERE conname = 'products_shipping_nonnegative'
    ) THEN
      ALTER TABLE products ADD CONSTRAINT products_shipping_nonnegative
        CHECK (shipping_cents IS NULL OR shipping_cents >= 0);
    END IF;
  END $$`,

  `DO $$ BEGIN
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint WHERE conname = 'products_taxes_nonnegative'
    ) THEN
      ALTER TABLE products ADD CONSTRAINT products_taxes_nonnegative
        CHECK (taxes_cents IS NULL OR taxes_cents >= 0);
    END IF;
  END $$`,
];

async function run() {
  console.log("Running migration 0008 — inventory fields…\n");
  for (const stmt of statements) {
    await sql.unsafe(stmt);
    console.log("  ✓", stmt.trim().slice(0, 60).replace(/\s+/g, " ") + "…");
  }
  await sql.end();
  console.log("\nMigration 0008 complete.\n");
}

run().catch((e) => {
  console.error("Migration failed:", e.message);
  process.exit(1);
});
