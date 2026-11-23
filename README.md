# Draper House: inventory and storefront app

An inventory and storefront app for Draper House, a small family antique and vintage business.

## The problem

Each item is one of a kind. Items were tracked by hand, so it was hard to know what was in stock, what was ready to list, and how long things had been sitting. The plan was an online store, but the store depends on clean inventory data, so inventory came first.

## What it does today

- **Mobile-first item capture:** photograph an item on a phone, add details, save. Built around how the owner actually works.
- **Admin inventory:** list and detail views, edit items, mark items "ready" to sell, days-in-inventory tracking, 14 fixed antique and vintage categories so the data stays consistent.
- **Storefront groundwork:** products, orders and a Stripe webhook ledger are in the schema. Checkout is the next phase.

## Stack

Next.js (App Router, TypeScript) · PostgreSQL · S3 for images · Stripe hosted checkout (planned)

## Security choices

- Payments go through Stripe hosted checkout only. The server never sees card data.
- Stripe webhook signature checks and an idempotency ledger, so an order is never created twice.
- Admin-only routes, HMAC-signed session cookies, input validation on every API route.
- All secrets come from environment variables. See `.env.example`.

## Running it locally

```bash
cp .env.example .env.local   # fill in values
npm install
npm run dev
```

Database schema: `db/schema.sql` and `db/migrations/`. Build notes: `docs/devlog.md`.
