/**
 * Run migration 0007 — adds ship_date column and READY status.
 * Usage (from project root):
 *   node scripts/run-migration-0007.mjs
 */

import { readFileSync } from "fs";
import { createRequire } from "module";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load .env.local manually (no dotenv dependency needed)
try {
  const env = readFileSync(resolve(__dirname, "../.env.local"), "utf8");
  for (const line of env.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const val = trimmed.slice(eqIdx + 1).trim();
    if (!process.env[key]) process.env[key] = val;
  }
} catch {
  // .env.local not found — rely on DATABASE_URL already being set in environment
}

const require = createRequire(import.meta.url);
const postgres = require("postgres");

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set. Add it to .env.local or export it before running.");
  process.exit(1);
}

const sql = postgres(url);

async function migrate() {
  console.log("Running migration 0007…");

  await sql.unsafe("ALTER TABLE products ADD COLUMN IF NOT EXISTS ship_date DATE");
  console.log("  ✓ Added ship_date column");

  await sql.unsafe("ALTER TABLE products DROP CONSTRAINT IF EXISTS products_status_check");
  await sql.unsafe("ALTER TABLE products DROP CONSTRAINT IF EXISTS products_inventory_status_consistent");
  console.log("  ✓ Dropped old constraints");

  await sql.unsafe(
    `ALTER TABLE products ADD CONSTRAINT products_status_check
     CHECK (status IN ('DRAFT', 'READY', 'ACTIVE', 'SOLD'))`
  );
  console.log("  ✓ Added updated status_check constraint");

  await sql.unsafe(
    `ALTER TABLE products ADD CONSTRAINT products_inventory_status_consistent CHECK (
      (status IN ('DRAFT', 'READY') AND inventory_quantity = 1 AND published_at IS NULL AND sold_at IS NULL)
      OR (status = 'ACTIVE' AND inventory_quantity = 1 AND published_at IS NOT NULL AND sold_at IS NULL)
      OR (status = 'SOLD' AND inventory_quantity = 0 AND sold_at IS NOT NULL)
    )`
  );
  console.log("  ✓ Added inventory_status_consistent constraint");

  await sql.end();
  console.log("\nMigration 0007 complete. Reload the app to see inventory feed.");
}

migrate().catch((e) => {
  console.error("Migration failed:", e.message);
  process.exit(1);
});
