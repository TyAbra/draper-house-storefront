# Draper House Storefront – Development Log

##  Feb 14 — Backend Foundation + Admin-Ready API Completed
Project Setup

Created Next.js 16 app (App Router, TypeScript)

Configured local PostgreSQL

Connected app via DATABASE_URL

Implemented DB health endpoint:
GET /api/health/db

Initialized Git repository and pushed to origin/main

# Database Architecture

Implemented production-safe schema:

Tables

products (single-quantity inventory model)

product_images

orders

order_items

processed_stripe_events (Stripe webhook idempotency ledger)

# Core Design Decisions

price_cents stored as integer (no floating point risk)

Inventory constrained at DB level (quantity 0 or 1)

Slug auto-generated for product URLs

Foreign keys enforced

Oversell protection handled at DB layer

Deterministic image ordering

# API Layer

Modular architecture:

Raw SQL repositories

Dedicated validation layer

No ORM

Clean route structure

Public Routes

GET /api/products
Returns active products + primary image

GET /api/products/[id]
Returns product + ordered images

Admin Routes (Bearer Protected)

POST /api/products

POST /api/products/[id]/images

# Admin Write Protection

Implemented requireAdmin() helper

Requires:
Authorization: Bearer <ADMIN_TOKEN>

401 without token

201 with valid token

Token stored only in .env.local

Token never exposed to browser

# Dev Stability

Encountered Turbopack persistence corruption (SST write errors)

Resolved by disabling Turbopack in dev:

"dev": "NEXT_DISABLE_TURBOPACK=1 next dev"


Dev environment stabilized.

# Verified Working

Product creation flow (201 → visible in GET)

Image attach flow (imageUrl payload)

Auth gating (401 / 201 behavior confirmed)

Slug generation

Price → cents conversion

Active product rendering

## Feb 15 — Admin UI + Secure Server Token Handling
Admin Interface

Implemented /admin page

Server action submits product form

Server action reads process.env.ADMIN_TOKEN

Server action calls /api/admin/products

Response JSON displayed on page

Active product list refreshes after creation

# Security Model Confirmed

No bearer token in browser

All token usage is server-side only

API remains modular (validation → repository → route)

No ORM introduced

No repository refactor performed

🚧 Next Phase

Implement login screen + cookie session for /admin

Add DRAFT status for staged inventory

Design mobile-first homepage experience

Add PWA support (installable web app)

Prepare Vercel + hosted Postgres deployment

## Feb 17 — Product Pivot: Storefront → Inventory Capture (Mobile-First)

Shifted project approach to phased delivery based on Mom’s real workflow.

Phase 1 MVP is now a mobile-first inventory capture web app (PWA-style) for iPhone use:

Login + private access

Add item with photos + required listing fields

Inventory list with Draft/Ready/Listed/Sold statuses

Generate “listing package” (copy/paste text + export photos) for Etsy/marketplaces

Payments/checkout/storefront moved to Phase 3 once inventory workflow is stable.


## Feb 28 — Dev Environment Break: Next.js Crash on Node 22 (Fixed by Pinning Node 20)

# What happened:
Both my machine and my dad’s machine failed to start the app after cloning/running:

bash
npm run dev
Next.js crashed immediately with:

TypeError: ... isStableBuild is not a function
Node version was v22.18.0
This was not an app-code bug; it was a runtime/tooling mismatch.

# Root cause
The repo is on Next.js 16.1.6
Running it with Node 22 caused a Next internal startup crash
Fresh GitHub clones were especially likely to hit this because Node versions vary per machine

# Fix (repo hardening so others don’t break)
Implemented guardrails so the repo runs predictably after cloning:

Pinned Node LTS in package.json:
"engines": { "node": "20.x" }
Added .nvmrc:
20
Added .npmrc:
engine-strict=true
This forces npm install to fail fast on the wrong Node version instead of crashing in Next at runtime.
Added .env.example (commit-safe template) and updated .gitignore so it can be committed:
.gitignore still ignores .env.local and other secret env files
explicitly allows !.env.example

# Steps to run on a new machine (for dad)

Install/load nvm (Homebrew install requires adding to ~/.zshrc)
In the repo:
nvm install 20
nvm use 20
rm -rf node_modules .next
npm install
npm run dev
Create .env.local from .env.example and fill in required env vars:
DATABASE_URL
APP_LOGIN_PASSWORD
STRIPE_SECRET_KEY
STRIPE_WEBHOOK_SECRET
Outcome
Repo now enforces a stable Node version (20.x)
Fresh clones no longer “mysteriously” crash on startup due to Node 22
Environment setup is documented via .env.example
Status


## Mar 4 — Add Item Flow Fixed (Product ID Parsing) + Image Attach Working

# What happened
The /admin/items/new “Add Item” form failed after saving with:

Item created but response was missing product id

This blocked the image upload + attach pipeline.

# Root cause
The admin server action expected the create-product API response to return:

product.id as a JavaScript number

In practice, id could come back in a non-number form (string/bigint-like), causing the server action to treat it as missing even though the product was created.

# Fix
Updated product id parsing in the admin server action to accept:

number
string (e.g. "474")
bigint

This allowed the action to proceed to:

Upload images via /api/admin/uploads/images
Attach images via /api/products/:id/images

# Verified working
Save Draft / Save Ready now returns:

Item saved. Open item detail

Inventory feed shows the uploaded image on the item card.

# Dev UX
Hydration mismatch overlay appeared in dev due to extra attributes injected into the DOM.
Added suppressHydrationWarning on the root <html> element in app layout to reduce noisy dev overlays.


## Mar 22 — Inventory Field Alignment, Security Hardening, S3 Storage, Architecture Refactor

Major pass across the entire codebase addressing field alignment, critical security issues, architecture problems, and missing UX features. All changes are TypeScript-clean (zero compiler errors).

---

### Database — Migration 0007

New file: `db/migrations/0007_add_ship_date_ready_status.sql`

Run this against the live database before deploying.

Changes:
- Added `ship_date DATE` column to `products` for tracking when sold items are shipped.
- Upgraded the `status` enum from 3 values to 4: `DRAFT`, `READY`, `ACTIVE`, `SOLD`.
  - `READY` is now a real DB status for items that have photos and are ready to list, replacing the previous UI-only inference from image count.
- Updated the `products_inventory_status_consistent` constraint to allow `DRAFT` and `READY` to share the same lifecycle rules (quantity = 1, no published_at, no sold_at).
- Updated `db/schema.sql` snapshot to reflect the full current schema.

---

### New Inventory Fields — Exposed Across the App

Four fields requested by the inventory workflow are now visible/editable throughout the app:

- **Quantity on Hand** — displayed from `inventory_quantity` on the item detail page.
- **Days in Inventory** — computed live from `created_at` (no DB column needed).
- **Date Sold** — surfaced from the existing `sold_at` column on the item detail page.
- **Ship Date** — new `ship_date` column, editable in both the new item form and the edit form.

---

### Security — Critical Fixes

#### Session Cookie (session.ts)
- Previous: cookie value was a static hardcoded string `"authenticated"` — anyone who knew the cookie name could forge a session.
- Fix: cookie now stores a cryptographically random 32-byte hex token, HMAC-SHA256 signed with a new `SESSION_SECRET` environment variable.
- Verification uses `timingSafeEqual` to prevent timing-based attacks.
- `sameSite` policy upgraded from `"lax"` to `"strict"`.
- `SESSION_SECRET` must be added to `.env.local` (generation command documented in `.env.example`).

#### Admin Token Comparison (admin.ts)
- Previous: token comparison used `===` (plain equality), vulnerable to timing attacks.
- Fix: comparison now uses `timingSafeEqual` via a `safeTokenEquals` helper.

---

### Architecture — Critical Fix

#### Server Actions No Longer Make HTTP Loops (actions.ts)
- Previous: server actions (createInventoryItemAction, listAdminProductsAction, publishProductAction, etc.) called their own app's API routes via `fetch()`, requiring `APP_BASE_URL` to be configured and shuttling `ADMIN_TOKEN` in headers between the same process.
- Fix: all server actions now call the repository functions directly (createProduct, listAllProductsForAdmin, publishProduct, etc.). The HTTP round-trip, APP_BASE_URL dependency, and internal bearer token passing are eliminated.
- Exception: the CSV import action still calls the API route, since that route uses a dedicated CSV parsing module.
- The `AdminCreateProductState` type and the old `createAdminProductAction`/`callAdminApi` helpers have been removed.
- `listAdminProductsAction` (paginated) and `listAllAdminProductsAction` (full list for inventory feed) are now separate functions.

---

### S3 Image Storage — Critical Fix

New file: `src/lib/storage/s3.ts`

- Previous: uploaded images were written to `public/uploads/` on the local filesystem. This is incompatible with Vercel (read-only filesystem) — all images would be lost on every deployment.
- Fix: `uploadImageToS3()` uploads to an S3 bucket when the four `AWS_*` env vars are configured. Falls back to local filesystem when not configured (dev only, with a clear warning comment).
- Image upload route (`/api/admin/uploads/images`) and the server action both use the shared S3 utility.
- `isS3Configured()` checks for all four required env vars at runtime.
- Requires `npm install @aws-sdk/client-s3` (run locally — package registry unavailable in sandbox).
- Required IAM policy: `s3:PutObject` on `arn:aws:s3:::YOUR_BUCKET/uploads/*`.
- Uploaded objects use `Cache-Control: public, max-age=31536000, immutable` since filenames include timestamp + UUID.

---

### UX — Medium Fixes

#### Edit Item (item-detail-client.tsx)
- Item detail page now has a full inline edit form accessible via an "Edit" button.
- Pre-populates all current field values.
- Editable fields: Title, Price, Category, Condition, Dimensions, SKU, Weight, Suggested Price Low/High, Ship Date, Notes.
- Powered by new `updateInventoryItemAction` server action and `updateProduct` repository function.
- Edit button is hidden for Sold items.

#### Mark Sold Button
- Available on the inventory list card (inline, with `confirm()` prompt) and on the item detail page.
- Allows marking any non-Sold item as Sold without requiring a Stripe webhook.
- Powered by new `markProductSoldAction` server action.

#### Mark Ready Button (item-detail-client.tsx)
- Draft items now have a "Mark Ready" button alongside "Mark Listed."
- Promotes the item from `DRAFT` to `READY` status in the database.
- Powered by new `markProductReadyAction` server action and `markProductReady` repository function.

#### "Save Ready" Now Stores READY Status
- Previously, "Save Ready" saved as DRAFT and readiness was inferred from image count.
- Now: if intent is "ready" and at least one photo uploads successfully, the item is promoted to READY status immediately after creation.

#### Category Dropdown
- Category field is now a `<select>` with 14 predefined antique/vintage categories instead of a free-text input.
- Eliminates inconsistent casing (e.g. "furniture" vs "Furniture") that broke category filtering.
- Categories: Furniture, Art & Prints, Ceramics & Pottery, Glass & Crystal, Jewelry & Accessories, Lighting, Mirrors, Rugs & Textiles, Silver & Metalwork, Clocks & Watches, Books & Ephemera, Kitchenware, Décor & Accessories, Other.
- Edit form preserves any existing non-standard category value as a selectable option for backwards compatibility.

#### Inventory List Pagination (admin-client.tsx)
- Previous: list was hardcoded to 100 items max — anything beyond that was silently invisible.
- Fix: all items are loaded at once, then paginated in groups of 24 on the client. A "Load more (N remaining)" button appears when there are more items.
- Item count ("N items total") displayed in the inventory header.

#### Inventory Detail View — New Fields
- Item detail page now shows a dedicated "Inventory Details" section with: Quantity on Hand, Days in Inventory, Date Added, Date Sold, Ship Date.
- "Item Info" section now displays all fields in a clean two-column grid.

---

### Environment — .env.example Updated

Added documentation for three new required/optional variables:
- `SESSION_SECRET` — required, must be 32+ chars (HMAC signing key for session cookies).
- `ADMIN_TOKEN` — documented with generation command.
- `AWS_S3_BUCKET`, `AWS_S3_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` — S3 credentials, optional in dev, required for production image persistence.

---

### Files Changed

| File | Change |
|------|--------|
| `db/migrations/0007_add_ship_date_ready_status.sql` | New — run against live DB |
| `db/schema.sql` | Updated snapshot |
| `.env.example` | Added SESSION_SECRET, ADMIN_TOKEN, AWS_* vars |
| `src/lib/storage/s3.ts` | New — S3 upload utility with local fallback |
| `src/lib/auth/session.ts` | Rewritten — HMAC-signed cookie, timingSafeEqual |
| `src/lib/auth/admin.ts` | Updated — timingSafeEqual token comparison |
| `src/lib/products/validation.ts` | Added READY status, shipDate, UpdateProductInput, parseUpdateProductBody, parseOptionalDate |
| `src/lib/products/repository.ts` | Added ship_date + created_at to all queries; new updateProduct, markProductReady functions; publishProduct now accepts DRAFT or READY |
| `src/app/admin/actions.ts` | Full rewrite — direct DB calls, new actions: updateInventoryItemAction, markProductReadyAction, markProductSoldAction, listAllAdminProductsAction |
| `src/app/admin/page.tsx` | Uses listAllAdminProductsAction |
| `src/app/admin/admin-client.tsx` | Pagination, Mark Sold button, READY status display |
| `src/app/admin/items/new/new-item-client.tsx` | Category dropdown, Save Ready → READY status |
| `src/app/admin/items/[id]/item-detail-client.tsx` | Edit form, Mark Sold, Mark Ready, new inventory fields display |
| `src/app/api/admin/uploads/images/route.ts` | S3 upload with local fallback |

---

### Pending Before Production Deploy

1. Run `psql $DATABASE_URL -f db/migrations/0007_add_ship_date_ready_status.sql`
2. Add `SESSION_SECRET` to `.env.local`: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
3. Run `npm install @aws-sdk/client-s3` locally
4. Set `AWS_S3_BUCKET`, `AWS_S3_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` for S3 image storage
5. Update `APP_LOGIN_PASSWORD` to a strong password in `.env.local`


---


## Mar 22 — Minor Issue Cleanup

Small follow-up pass resolving the remaining minor issues from the earlier code review.

### fflate Dependency — Not Dead

Initial review flagged `fflate` as a potentially unused dependency. On closer inspection it is actively used in `src/lib/products/csv.ts` — specifically `unzipSync` and `strFromU8` for reading `.xlsx` files submitted via the CSV import flow. No change needed.

### Bulk Photo Download — Browser Blocking Fixed (`item-detail-client.tsx`)

Previous: the "Download / Export Photos" button fired `anchor.click()` in a synchronous loop for every image. Browsers treat multiple near-simultaneous programmatic downloads as a pop-up and silently block all but the first.

Fix: each download is now staggered with a 600ms `setTimeout` delay between them. This gives the browser enough time to register each download individually without triggering the pop-up blocker. The individual "Photo #1 / #2 / …" links below the button remain available as a manual fallback for any photo that doesn't download automatically.

### `suppressHydrationWarning` Scoped Correctly (`layout.tsx`)

Previous: `suppressHydrationWarning` was set on both `<html>` and `<body>`. The one on `<body>` was overly broad — it silenced React hydration warnings for the entire app tree, potentially hiding real component-level hydration bugs in production.

Fix: removed `suppressHydrationWarning` from `<body>`. The attribute is kept on `<html>` only, which is the standard and intentional use — browser extensions (password managers, Grammarly, etc.) commonly inject attributes like `class` or `data-*` onto the root `<html>` element after hydration, causing false-positive React warnings. `suppressHydrationWarning` on `<html>` is scoped to that single element and does not affect the rest of the component tree. Added a comment in the code explaining the intent.

### Files Changed

| File | Change |
|------|--------|
| `src/app/admin/items/[id]/item-detail-client.tsx` | Staggered bulk photo downloads (600ms gap) |
| `src/app/layout.tsx` | Removed `suppressHydrationWarning` from `<body>`, kept on `<html>` with explanatory comment |

---

## Mar 22 — Presentation Layer Improvements

Four targeted UI/UX improvements following a review of the presentation layer.

### 1. Distinct Status Badge Colors

Previously "Ready" and "Listed" (ACTIVE) displayed identical olive-green badges, making it impossible to distinguish items at a glance. Fixed with a proper semantic color map:

- **Draft** — muted brass (low-opacity, barely-there warm gold)
- **Ready** — brass (`var(--dh-brass)`, 25% opacity background) — item is prepared but not yet on sale
- **Listed** — olive (`var(--dh-olive)`) — item is live and for sale
- **Sold** — terracotta (`var(--dh-terracotta)`) — no further changes allowed

Applied to `LifecycleBadge` in both `admin-client.tsx` and `item-detail-client.tsx`.

### 2. Status Filter Pills on Inventory Feed

The inventory feed previously listed all items (Draft, Ready, Listed, Sold) in a single mixed scroll. Added a horizontal row of filter pills — All / Draft / Ready / Listed / Sold — with live item counts. Selecting a pill filters the displayed cards client-side (no network round-trip). The page counter resets to 1 when the filter changes. The empty state message is filter-aware ("No listed items." instead of a generic "No items yet.").

### 3. Ship Date Field in Add Item Form

The Ship Date input was present in the Edit form (item detail page) but missing from the Add Item form. Added it to the Optional section of `new-item-client.tsx`, between Weight and Notes. The value flows through the existing `parseCreateProductBody` validation which already handled `shipDate`.

### 4. Add Photos from Item Detail Page

Previously photos could only be uploaded at item-creation time. Once saved, there was no way to attach additional photos from the detail page. Added:

- New `addPhotosAction` server action in `actions.ts` — accepts a `productId` and one or more `File` objects, uploads via the same `uploadImageFile` helper (S3 or local filesystem), then calls `addProductImage` for each.
- New `AddPhotosForm` sub-component in `item-detail-client.tsx` — renders Take Photo / Choose from Library buttons with a hidden file input each, accumulates selected files in local state, shows a count preview, and submits with a single "Upload N Photos" button. On success it calls `refresh()` so the photo strip updates immediately.
- The form is hidden for SOLD items (no modifications allowed).

### Files Changed

| File | Change |
|------|--------|
| `src/app/admin/admin-client.tsx` | Fixed Ready/Draft badge colors; added status filter pills with live counts |
| `src/app/admin/items/[id]/item-detail-client.tsx` | Fixed Ready badge color; added `AddPhotosForm` sub-component and import |
| `src/app/admin/items/new/new-item-client.tsx` | Added Ship Date field to the Optional section |
| `src/app/admin/actions.ts` | Added `addPhotosAction` server action and `AddPhotosState` type |

---

## Mar 22 — Remaining Presentation Issues

Follow-up pass resolving the rest of the presentation layer issues identified in review.

### "Load More" Count Bug

After adding status filtering, the "Load more (N remaining)" counter still referenced `allProducts.length` instead of `filteredProducts.length`. This would have shown the wrong remaining count when a filter was active. Fixed to use `filteredProducts.length`.

### Condition Field → Standardized Dropdown

The Condition field was a required free-text input on both the Add Item and Edit forms, leading to inconsistent entries ("good", "Good", "Very good condition") that prevent meaningful sorting or filtering later. Replaced with a `<select>` dropdown on both forms using six standard grades: Excellent / Very Good / Good / Fair / Poor / As-Is. The Edit form includes a fallback `<option>` for any legacy free-text value already in the database that doesn't match the list, so existing data is preserved.

### Redundant "Add Item" Header Button Removed

The sticky top header contained an "Add Item" button linking to `/admin/items/new` — identical to the "Add" tab in the bottom tab bar. Removed the header button. The header now shows only the "Draper House" wordmark.

### Settings Page Fleshed Out

The Settings page previously contained only a Logout button. Expanded to four sections: Item Lifecycle (visual reference card showing each status badge with a description), Condition Grades (pill display of all six grades), Security (instructions for changing the login password), and Session (Sign Out button, restyled as a terracotta outline button).

### Files Changed

| File | Change |
|------|--------|
| `src/app/admin/admin-client.tsx` | Fixed "Load more" count to use `filteredProducts.length` |
| `src/app/admin/items/new/new-item-client.tsx` | Condition field → dropdown; added `CONDITIONS` constant |
| `src/app/admin/items/[id]/item-detail-client.tsx` | Condition field → dropdown in EditForm with legacy value fallback |
| `src/app/admin/layout.tsx` | Removed redundant "Add Item" header button |
| `src/app/admin/settings/page.tsx` | Full rewrite — lifecycle reference, condition grades, security note, sign-out |
---

## Mar 22 — List View Polish: Action Strip & Category Normalization

### Action Strip Tightened

The action button strip beneath each inventory row was visually as tall as the item details themselves, throwing off the compact list layout. Tightened it:

- Reduced button vertical padding from `py-1.5` to `py-1`
- Reduced font size from `text-xs` to `text-[11px]`
- Reduced gap between buttons from `gap-2` to `gap-1.5`
- Reduced strip padding from `py-2` to `py-1.5`
- Removed `flex-1` width expansion — buttons now size to their label
- The entire strip is now conditionally hidden for SOLD items (no actions available), eliminating the dead `<span>Sold</span>` placeholder row

### Category Normalization

CSV-imported inventory items had categories in a legacy slash-format (e.g. `"Home Decor / Folk Art"`, `"Ceramics / Pottery"`) that don't match the standardized dropdown values introduced in the Add Item form.

Two-part fix:

**Display layer** — Added `normalizeCategory()` function in `admin-client.tsx`. It checks if a category is already canonical; if not, it applies keyword matching to map it to the closest standard value (e.g. `"Home Decor / Folk Art"` → `"Décor & Accessories"`). This makes the list view display clean immediately without requiring a DB migration.

**Database migration script** — Added `scripts/normalize-categories.mjs`. Run it dry first to preview proposed remappings:

```
node scripts/normalize-categories.mjs
```

Then apply to the database:

```
node scripts/normalize-categories.mjs --apply
```

The script queries all distinct `category` values, checks each against the canonical list, applies the same keyword-matching logic to propose a normalized value (falling back to `"Other"` for anything unrecognized), and prints a full audit before applying.

### Files Changed

| File | Change |
|------|--------|
| `src/app/admin/admin-client.tsx` | Tightened action strip padding/sizing; added `normalizeCategory()` helper and `CATEGORY_KEYWORD_MAP`; category display now uses normalized value |
| `scripts/normalize-categories.mjs` | New script — dry-run preview + `--apply` flag to bulk-normalize legacy categories in the database |

---

## Mar 22 — Edit Button on Inventory List

Added an explicit **Edit** button to the action strip on every inventory row.

Previously the entire row was a tappable link to the item detail/edit page, but there was no visible affordance indicating that. The Edit button makes the action obvious.

Implementation details:
- Edit is a `<Link>` to `/admin/items/[id]` rendered as a pill button at the trailing (right) edge of the action strip via `ml-auto`
- Appears on **all** items including SOLD items — the action strip now renders for every row
- For SOLD items, Edit is the only button in the strip (status-change buttons remain hidden for sold items)
- Styled as a `var(--dh-wood)` outline pill matching the "Move to Draft" button weight; brightens to `var(--dh-brass)` on hover

### Files Changed

| File | Change |
|------|--------|
| `src/app/admin/admin-client.tsx` | Edit button added to action strip; strip now renders for all items |

---

## Mar 22 — Full Inventory Field Expansion

Aligned all field names and data structures to match the inventory spreadsheet. Every field from the user's inventory file now has a corresponding DB column, UI label, form input, and display row.

### New DB Columns (migration 0008)

Run to apply:
```
node scripts/run-migration-0008.mjs
```

| Column | Type | Maps to |
|--------|------|---------|
| `year_of_purchase` | TEXT | Year of Purchase |
| `purchase_date` | DATE | Purchase Date |
| `store_source` | TEXT | Store/Source |
| `receipt_photo_link` | TEXT | Receipt Photo Link |
| `receipt_documentation` | TEXT | Receipt Documentation |
| `cog_cents` | INTEGER | COG |
| `final_sales_price_cents` | INTEGER | Final Sales Price |
| `shipping_cents` | INTEGER | Shipping |
| `taxes_cents` | INTEGER | Taxes |
| `image_link` | TEXT | Image Link |
| `item_description` | TEXT | Item Description (internal) |
| `sell_site_location` | TEXT | Sell Site Location |
| `measurements` | TEXT | Measurements |

Existing columns already covered: `sku`, `name`, `category`, `description` (Full Product Description), `condition_note`, `dimensions`, `suggested_price_low_cents` (Price Min), `suggested_price_high_cents` (Price Max), `price_cents` (Listing Price), `sold_at`, `ship_date`, `inventory_quantity`, `created_at`.

### Calculated Fields (no storage — computed on the fly)

| Field | Formula |
|-------|---------|
| Mid Price | (Price Min + Price Max) / 2 |
| Suggested Price Range | display of Price Min – Price Max |
| Fees (13%) | Final Sales Price × 0.13 |
| Net Profit | Final Sales Price − COG − Fees − Shipping − Taxes |
| Margin % | Net Profit / Final Sales Price × 100 |
| ROI % | Net Profit / COG × 100 |

### Item Detail Page (`/admin/items/[id]`)

Reorganized into six clearly labelled sections visible in both read and edit modes:
- **Identity** — SKU, Year of Purchase, Item Name, Product Category, Status
- **Descriptions** — Item Description (internal) + Full Product Description (for listing)
- **Condition & Physical** — Condition, Dimensions, Measurements
- **Acquisition** — Purchase Date, Store/Source, COG, Receipt Photo Link, Receipt Documentation
- **Pricing & Financials** — all pricing fields + calculated mid price, fees, net profit, margin %, ROI %
- **Media & Logistics** — Image Link, Sell Site Location, Ship Date
- **Inventory Status** (display only) — Quantity on Hand, Days in Inventory, Date Sold

### Add Item Form (`/admin/items/new`)

All sections above are now present as form inputs from the start.

### Admin List View (`/admin`)

Each row now shows:
- Condition grade alongside category chip
- Financial summary row: COG · Price Range · Sold For · Net Profit + Margin%
- Inventory row: days in stock · Store/Source · Date Sold · Ship Date
- Net Profit shown in olive (positive) or terracotta (negative) for quick scanning

### Files Changed

| File | Change |
|------|--------|
| `db/migrations/0008_inventory_fields.sql` | New SQL migration |
| `scripts/run-migration-0008.mjs` | Node.js runner for migration 0008 |
| `src/lib/products/validation.ts` | All new fields added to CreateProductInput / UpdateProductInput |
| `src/lib/products/repository.ts` | InventoryFields type, full SELECT/INSERT/UPDATE for all new columns |
| `src/app/admin/actions.ts` | createInventoryItemAction + updateInventoryItemAction now read all new form fields |
| `src/app/admin/items/[id]/item-detail-client.tsx` | Full rewrite — 6-section layout, calcFinancials(), FieldRow/CalcField components |
| `src/app/admin/items/new/new-item-client.tsx` | All new field sections added to Add Item form |
| `src/app/admin/admin-client.tsx` | calcNetProfit(), financial summary row, condition + store/source in list rows |

---

## Mar 22 — Admin UX: Detailed List View, Bug Fixes, SKU Generation

### Qty OH Label + Admin List Display

- Renamed "Quantity on Hand" label to **"Qty OH"** across item detail page and admin list cards.
- `Qty OH` value is now visible directly on each card in the inventory list (inventory status row, alongside days in stock).

### Files Changed

| File | Change |
|------|--------|
| `src/app/admin/items/[id]/item-detail-client.tsx` | Label renamed to "Qty OH" |
| `src/app/admin/admin-client.tsx` | Qty OH added to inventory status row on each card |

---

### Detailed List View + CSV Export

Added a **Detailed List** view alongside the existing card view. Toggle between them via new **Cards / Detailed List** pills in the inventory header.

**Detailed List** is a wide, horizontally-scrollable table showing every item as a single row with all fields:
SKU · Item Name (sticky left column) · Status · Category · Condition · Dimensions · Measurements · Year · Purchase Date · Store/Source · COG · Price Min · Price Max · Mid Price · Final Sale · Fees 13% · Shipping · Taxes · Net Profit · Margin % · ROI % · Item Description · Sell Site · Image Link · Receipt Photo · Receipt Docs · Qty OH · Days in Stock · Date Sold · Ship Date · Actions

Notes:
- Image thumbnail and Full Product Description are intentionally excluded (not useful in tabular context)
- Calculated fields (Mid Price, Fees, Net Profit, Margin %, ROI %) shown in italic/muted style to distinguish from stored values
- Net Profit coloured olive (positive) or terracotta (negative) for instant scanning
- Empty cells render a muted dash rather than blank space
- Status filter pills work the same way in both views
- In Detailed List mode the container widens to `max-w-[98vw]` to give the table room

**Export CSV** button appears in the Detailed List toolbar. Downloads all currently-filtered items (respects the status filter) as a `.csv` file named `draper-house-inventory-<date>.csv`. Export is client-side — no network round-trip.

### Files Changed

| File | Change |
|------|--------|
| `src/app/admin/admin-client.tsx` | `DetailedList` component, `exportToCSV()` function, view mode toggle, `ViewMode` type, `formatMoneyRaw()` helper, ROI % in `calcNetProfit()` |

---

### Bug Fix — "Invalid product id" on Edit Save

**Root cause:** `products.id` is `BIGSERIAL` (PostgreSQL bigint). The `postgres` npm library returns bigint columns as JavaScript **strings** at runtime despite the TypeScript type declaring them as `number`. So `product.id` was `"42"` (a string) when passed as a bound argument to the server action, causing `Number.isInteger("42") === false` and the early-return guard to fire.

**Fix (two layers):**
1. `repository.ts` — all three row-mapping sites now coerce with `id: Number(row.id)` so the ID is always a proper JS number as it leaves the DB layer.
2. `actions.ts` — both `getAdminProductDetailAction` and `updateInventoryItemAction` now defensively coerce with `Number(productId)` before the validity guard.

### Files Changed

| File | Change |
|------|--------|
| `src/lib/products/repository.ts` | `id: Number(row.id)` in all three row mappers |
| `src/app/admin/actions.ts` | Defensive `Number(productId)` coercion in `getAdminProductDetailAction` and `updateInventoryItemAction` |

---

### Bug Fix — Inventory List Capped at 100 Items

**Root cause:** Two separate limits were in effect:
1. `listAllAdminProductsAction` was passing `limit: "500"` to `parseProductListFilters`.
2. `parseLimit()` inside that parser hard-capped any value at `Math.min(limit, 100)` — so "500" silently became 100.

**Fix:**
- `ProductListFilters.limit` is now `number | null` where `null` means no `LIMIT` clause.
- `listAllProductsForAdmin` always passes `limit: null`, completely removing the LIMIT from the admin SQL query.
- `listProducts` builds the SQL LIMIT clause conditionally — omitted entirely when `limit` is `null`.
- The action no longer passes any limit parameter.
- Storefront-facing functions retain their numeric limits unchanged.

### Files Changed

| File | Change |
|------|--------|
| `src/lib/products/validation.ts` | `ProductListFilters.limit` changed to `number \| null`; `parseLimit` return type updated |
| `src/lib/products/repository.ts` | `listProducts` builds LIMIT clause conditionally; `listAllProductsForAdmin` passes `limit: null` |
| `src/app/admin/actions.ts` | Removed `limit: "500"` from `listAllAdminProductsAction` |

---

### Bug Fix — React setState-During-Render Error on Edit Save

**Error:** `Cannot update a component (ItemDetailClient) while rendering a different component (EditForm).`

**Root cause:** `EditForm` called `onSaved(state.updatedProduct)` directly in the render body, triggering a parent state update during a child render cycle.

**Fix:** Moved the `onSaved` call into a `useEffect` with `[state.updatedProduct, state.error, onSaved]` as dependencies. The callback now fires after the render completes rather than during it.

### Files Changed

| File | Change |
|------|--------|
| `src/app/admin/items/[id]/item-detail-client.tsx` | `onSaved` call moved into `useEffect`; `useEffect` added to imports |

---

### Photo Not Required for Save Ready

Removed the hard block that prevented saving an item as Ready when no photo had been attached. The validation guard `if (intent === "ready" && photoFiles.length === 0)` has been deleted from `createInventoryItemAction`.

### Files Changed

| File | Change |
|------|--------|
| `src/app/admin/actions.ts` | Removed photo-required guard from `createInventoryItemAction` |

---

### Auto-Generated SKU on New Item Form

The SKU field on the Add Item form is now pre-populated with the next sequential SKU in `SKU-NNN` format.

**Format:** `SKU-` followed by the next integer, zero-padded to at least 3 digits (e.g. `SKU-001`, `SKU-042`, `SKU-100`, `SKU-1000`). The number is derived from the highest numeric suffix among all existing `SKU-NNN` items in the database, so deleting items does not reuse numbers.

**Implementation:**
- `generateNextSku()` in `repository.ts` — queries `MAX(CAST(SUBSTRING(sku FROM 5) AS INTEGER))` filtered to rows matching `^SKU-[0-9]+$`. Returns `SKU-001` when no matching items exist.
- `getNextSkuAction()` in `actions.ts` — thin server action wrapper.
- `new-item-client.tsx` — calls the action on mount via `useEffect`, stores result in `autoSku` state, pre-populates the SKU input. Field remains editable so it can be overridden before saving.

### Files Changed

| File | Change |
|------|--------|
| `src/lib/products/repository.ts` | New `generateNextSku()` function |
| `src/app/admin/actions.ts` | New `getNextSkuAction()` server action; `generateNextSku` added to import |
| `src/app/admin/items/new/new-item-client.tsx` | `autoSku` state, `getNextSkuAction` import, `useEffect` on mount, controlled SKU input |
