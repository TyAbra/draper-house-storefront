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