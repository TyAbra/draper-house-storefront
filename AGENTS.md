# Draper House Storefront - Agent Rules

This repository is an MVP production e-commerce system for a real business.
The goal is stability, security, and maintainability - not experimentation.

Agents must follow these rules strictly.

---

## 1. Development Philosophy

Build the smallest working production system first.

Core workflow priority order:
Browse -> Checkout -> Payment Webhook -> Mark Item Sold -> Admin Upload

Do NOT add features unless explicitly requested.

This is not a demo project.
This is not a UI playground.
This is not a template generator.

Every change must support real sales.

---

## 2. Security Requirements (MANDATORY)

Never implement custom payment processing.

Payments MUST use Stripe hosted checkout.
The server must never receive raw card data.

Required protections:
- Verify Stripe webhook signatures
- Idempotent order creation
- Input validation on all API routes
- No public admin endpoints
- Role-based authorization
- MFA enforced for admin users

Never store secrets in code.
Always use environment variables.

If unsure -> choose the safer implementation.

---

## 3. Architecture Rules

Follow API-first architecture.

Frontend responsibilities:
- Display data
- Collect user actions
- Call backend APIs

Backend responsibilities:
- Validation
- Business logic
- Database writes
- Security enforcement

Never put business logic in the frontend.

---

## 4. Database Rules

Products are single-quantity inventory items.

When purchase succeeds:
-> Mark product as SOLD immediately
-> Prevent overselling

Database is source of truth.
Never trust client state.

All writes must happen server-side.

---

## 5. Coding Style

Prefer simple over clever.

Avoid abstractions unless repeated 3+ times.
Avoid premature optimization.
Avoid large libraries for small problems.

Write readable TypeScript.

Bad:
Generic reusable mega-systems

Good:
Small explicit functions

---

## 6. MVP Scope Control

Allowed in MVP:
- Product listing
- Product detail
- Stripe checkout
- Order creation
- Admin login
- Manual product upload
- Spreadsheet import
- Mark sold automatically

NOT allowed unless requested:
- Discounts
- Coupons
- Reviews
- Chat
- Recommendations
- Analytics dashboards
- AI features
- Shipping automation
- Mobile app code

---

## 7. Change Safety

Before modifying:
Explain what will change and why.

Never rewrite large sections without approval.

Prefer incremental edits over rewrites.

---

## 8. Commands

Install:
npm install

Run dev server:
npm run dev

Lint:
npm run lint

Build:
npm run build

---

## 9. Agent Behavior

If a request conflicts with these rules:
ASK before implementing.

If a change increases complexity:
Propose a simpler option.

Act like a production engineer, not a prototype generator.
