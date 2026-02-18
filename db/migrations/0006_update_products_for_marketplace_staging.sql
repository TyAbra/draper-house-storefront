-- Add lifecycle + marketplace attributes for admin staging workflow.

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ;

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS sku TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS category TEXT,
  ADD COLUMN IF NOT EXISTS condition_note TEXT,
  ADD COLUMN IF NOT EXISTS dimensions TEXT,
  ADD COLUMN IF NOT EXISTS weight_lbs NUMERIC,
  ADD COLUMN IF NOT EXISTS suggested_price_low_cents INTEGER,
  ADD COLUMN IF NOT EXISTS suggested_price_high_cents INTEGER;

ALTER TABLE products
  ALTER COLUMN status SET DEFAULT 'DRAFT';

-- Backfill currently active items so they satisfy the ACTIVE lifecycle rule.
UPDATE products
SET published_at = created_at
WHERE status = 'ACTIVE' AND published_at IS NULL;

ALTER TABLE products
  DROP CONSTRAINT IF EXISTS products_status_check;

ALTER TABLE products
  DROP CONSTRAINT IF EXISTS products_inventory_status_consistent;

ALTER TABLE products
  ADD CONSTRAINT products_status_check
  CHECK (status IN ('DRAFT', 'ACTIVE', 'SOLD'));

ALTER TABLE products
  ADD CONSTRAINT products_inventory_status_consistent CHECK (
    (status = 'DRAFT' AND inventory_quantity = 1 AND published_at IS NULL AND sold_at IS NULL)
    OR
    (status = 'ACTIVE' AND inventory_quantity = 1 AND published_at IS NOT NULL AND sold_at IS NULL)
    OR
    (status = 'SOLD' AND inventory_quantity = 0 AND sold_at IS NOT NULL)
  );

ALTER TABLE products
  ADD CONSTRAINT products_weight_lbs_nonnegative
    CHECK (weight_lbs IS NULL OR weight_lbs >= 0),
  ADD CONSTRAINT products_suggested_price_low_nonnegative
    CHECK (suggested_price_low_cents IS NULL OR suggested_price_low_cents >= 0),
  ADD CONSTRAINT products_suggested_price_high_nonnegative
    CHECK (suggested_price_high_cents IS NULL OR suggested_price_high_cents >= 0),
  ADD CONSTRAINT products_suggested_price_range_valid
    CHECK (
      suggested_price_low_cents IS NULL
      OR suggested_price_high_cents IS NULL
      OR suggested_price_high_cents >= suggested_price_low_cents
    );

CREATE INDEX IF NOT EXISTS idx_products_category ON products (category);
CREATE INDEX IF NOT EXISTS idx_products_price_cents ON products (price_cents);
