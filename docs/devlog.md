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