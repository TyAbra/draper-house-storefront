/**
 * Normalize legacy slash-format categories to the standardized category list.
 *
 * CSV-imported items often have categories like "Home Decor / Folk Art" that
 * don't match the dropdown values used in the edit form.
 *
 * Usage (from project root):
 *   node scripts/normalize-categories.mjs          # preview changes
 *   node scripts/normalize-categories.mjs --apply  # apply changes to DB
 */

import { readFileSync } from "fs";
import { createRequire } from "module";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load .env.local manually
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
  // rely on DATABASE_URL already being in environment
}

const require = createRequire(import.meta.url);
const postgres = require("postgres");

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set. Add it to .env.local or export it.");
  process.exit(1);
}

// ── Canonical category list (must match the app's CATEGORIES constant) ────
const CANONICAL = [
  "Furniture",
  "Art & Prints",
  "Ceramics & Pottery",
  "Glass & Crystal",
  "Jewelry & Accessories",
  "Lighting",
  "Mirrors",
  "Rugs & Textiles",
  "Silver & Metalwork",
  "Clocks & Watches",
  "Books & Ephemera",
  "Kitchenware",
  "Décor & Accessories",
  "Other",
];

const CANONICAL_SET = new Set(CANONICAL);

// ── Keyword → canonical mapping (longest/most specific first) ─────────────
const KEYWORD_MAP = [
  ["home decor", "Décor & Accessories"],
  ["folk art", "Décor & Accessories"],
  ["furniture", "Furniture"],
  ["chair", "Furniture"],
  ["table", "Furniture"],
  ["cabinet", "Furniture"],
  ["dresser", "Furniture"],
  ["painting", "Art & Prints"],
  ["photography", "Art & Prints"],
  ["print", "Art & Prints"],
  ["art", "Art & Prints"],
  ["ceramics", "Ceramics & Pottery"],
  ["pottery", "Ceramics & Pottery"],
  ["porcelain", "Ceramics & Pottery"],
  ["crystal", "Glass & Crystal"],
  ["glass", "Glass & Crystal"],
  ["jewelry", "Jewelry & Accessories"],
  ["jewellery", "Jewelry & Accessories"],
  ["accessories", "Jewelry & Accessories"],
  ["lighting", "Lighting"],
  ["chandelier", "Lighting"],
  ["lamp", "Lighting"],
  ["mirror", "Mirrors"],
  ["textiles", "Rugs & Textiles"],
  ["textile", "Rugs & Textiles"],
  ["fabric", "Rugs & Textiles"],
  ["rug", "Rugs & Textiles"],
  ["metalwork", "Silver & Metalwork"],
  ["silver", "Silver & Metalwork"],
  ["bronze", "Silver & Metalwork"],
  ["brass", "Silver & Metalwork"],
  ["metal", "Silver & Metalwork"],
  ["watches", "Clocks & Watches"],
  ["clocks", "Clocks & Watches"],
  ["clock", "Clocks & Watches"],
  ["watch", "Clocks & Watches"],
  ["ephemera", "Books & Ephemera"],
  ["books", "Books & Ephemera"],
  ["book", "Books & Ephemera"],
  ["paper", "Books & Ephemera"],
  ["kitchenware", "Kitchenware"],
  ["kitchen", "Kitchenware"],
  ["decor", "Décor & Accessories"],
];

function normalizeCategory(raw) {
  if (!raw) return null;
  if (CANONICAL_SET.has(raw)) return raw; // already good
  const lower = raw.toLowerCase();
  for (const [keyword, canonical] of KEYWORD_MAP) {
    if (lower.includes(keyword)) return canonical;
  }
  return null; // no match — will mark as "Other" or skip
}

const apply = process.argv.includes("--apply");

const sql = postgres(url);

async function run() {
  // Fetch all distinct non-canonical categories
  const rows = await sql`
    SELECT DISTINCT category, COUNT(*) AS cnt
    FROM products
    WHERE category IS NOT NULL
    GROUP BY category
    ORDER BY cnt DESC
  `;

  const toUpdate = [];
  const unmatched = [];

  console.log("\n── Category audit ──────────────────────────────────────────");
  for (const row of rows) {
    const cat = row.category;
    if (CANONICAL_SET.has(cat)) {
      console.log(`  ✓  [${row.cnt}] ${cat}  (canonical)`);
    } else {
      const normalized = normalizeCategory(cat);
      if (normalized) {
        toUpdate.push({ from: cat, to: normalized, cnt: row.cnt });
        console.log(`  →  [${row.cnt}] "${cat}"  →  "${normalized}"`);
      } else {
        unmatched.push({ cat, cnt: row.cnt });
        console.log(`  ?  [${row.cnt}] "${cat}"  (no match — would set to "Other")`);
        toUpdate.push({ from: cat, to: "Other", cnt: row.cnt });
      }
    }
  }

  if (toUpdate.length === 0) {
    console.log("\nAll categories are already canonical. Nothing to do.");
    await sql.end();
    return;
  }

  console.log(`\n${toUpdate.length} category value(s) need updating.`);

  if (!apply) {
    console.log("\nRun with --apply to update the database:");
    console.log("  node scripts/normalize-categories.mjs --apply\n");
    await sql.end();
    return;
  }

  // Apply updates
  console.log("\nApplying updates…");
  for (const { from, to, cnt } of toUpdate) {
    await sql`UPDATE products SET category = ${to} WHERE category = ${from}`;
    console.log(`  ✓  Updated ${cnt} row(s): "${from}" → "${to}"`);
  }

  await sql.end();
  console.log("\nCategory normalization complete.\n");
}

run().catch((e) => {
  console.error("Error:", e.message);
  process.exit(1);
});
