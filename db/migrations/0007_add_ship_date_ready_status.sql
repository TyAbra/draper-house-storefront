-- Migration 0007: Add ship_date, READY status, and inventory field clarifications
-- Run against existing draper_house DB.

-- 1. Add ship_date for tracking when sold items are shipped
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS ship_date DATE;

-- 2. Upgrade status enum to include READY
--    DRAFT  = saved, no photos yet
--    READY  = has photos, ready to list on marketplace
--    ACTIVE = listed / published on marketplace
--    SOLD   = sold

ALTER TABLE products
  DROP CONSTRAINT IF EXISTS products_status_check;

ALTER TABLE products
  DROP CONSTRAINT IF EXISTS products_inventory_status_consistent;

ALTER TABLE products
  ADD CONSTRAINT products_status_check
  CHECK (status IN ('DRAFT', 'READY', 'ACTIVE', 'SOLD'));

-- Backfill: existing DRAFT items that already have images should stay DRAFT for now;
-- they can be promoted to READY through the UI. No automatic backfill needed.

ALTER TABLE products
  ADD CONSTRAINT products_inventory_status_consistent CHECK (
    (status IN ('DRAFT', 'READY') AND inventory_quantity = 1 AND published_at IS NULL AND sold_at IS NULL)
    OR
    (status = 'ACTIVE' AND inventory_quantity = 1 AND published_at IS NOT NULL AND sold_at IS NULL)
    OR
    (status = 'SOLD' AND inventory_quantity = 0 AND sold_at IS NOT NULL)
  );
