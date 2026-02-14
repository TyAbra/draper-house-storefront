# Draper House Storefront – Development Log

##  Feb 14 – Project Foundation Complete

Today I initialized the real application environment.

Completed:
- Created Next.js application
- Designed PostgreSQL schema for:
  - products
  - product_images
  - orders
  - order_items
  - processed_stripe_events (webhook idempotency)
- Installed and configured PostgreSQL locally
- Connected app to database via DATABASE_URL
- Built health check API route (/api/health/db)
- Verified DB connection works
- Added Git tracking and first commit
- Renamed project to "draper-house-storefront"

Current status:
The app backend and database layer are fully operational.
The system can now safely support product creation and checkout logic.

Next step:
Implement product API and admin inventory upload.

## Feb 14 – Backend Foundation + API Layer Complete

Today the application moved from project initialization to a functioning backend service.

Environment Setup

Created Next.js 16 application (App Router, TypeScript)

Installed and configured PostgreSQL locally

Connected app to database via DATABASE_URL

Built and verified database health endpoint: /api/health/db

Initialized Git repository

Renamed project to draper-house-storefront

Database Architecture

Designed and implemented production-safe schema:

Tables:

products (single-quantity inventory model)

product_images

orders

order_items

processed_stripe_events (webhook idempotency ledger)

Key characteristics:

Price stored as price_cents (integer)

Inventory stored as constrained quantity (0 or 1)

Slug generation for product URLs

Referential integrity enforced via foreign keys

Oversell prevention handled at DB layer

API Layer Implemented

Built modular API structure using repository + validation layers.

Implemented Routes

GET /api/products

POST /api/products

GET /api/products/[id]

POST /api/products/[id]/images

All queries use raw SQL (no ORM).
Validation layer enforces payload structure.
Price conversion (string → cents) handled server-side.
Slug auto-generated.
Inventory logic confirmed working.

Dev Environment Stabilized

Encountered Turbopack persistence corruption (SST write errors).

Resolution:

Cleared .next, .turbo, and cache directories

Disabled Turbopack in dev via:

"dev": "NEXT_DISABLE_TURBOPACK=1 next dev"


Result:

Stable dev runtime

No cache corruption

Clean API responses

Confirmed 201 insert + immediate 200 list consistency

Verified Functional Flow

Tested full product lifecycle:

POST product → 201 Created

Product stored with:

priceCents

inventoryQuantity

status: ACTIVE

GET products → returns inserted rows

Slug generation validated

Multiple products confirmed listing correctly

Backend is now fully operational.
