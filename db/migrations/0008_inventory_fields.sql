-- Migration 0008: Expand products table to match full inventory field set
-- New columns cover acquisition, pricing research, financials, and logistics.

ALTER TABLE products
  -- Acquisition
  ADD COLUMN IF NOT EXISTS year_of_purchase    TEXT,
  ADD COLUMN IF NOT EXISTS purchase_date       DATE,
  ADD COLUMN IF NOT EXISTS store_source        TEXT,
  ADD COLUMN IF NOT EXISTS receipt_photo_link  TEXT,
  ADD COLUMN IF NOT EXISTS receipt_documentation TEXT,
  -- Cost
  ADD COLUMN IF NOT EXISTS cog_cents           INTEGER,
  -- Financial outcome (post-sale)
  ADD COLUMN IF NOT EXISTS final_sales_price_cents INTEGER,
  ADD COLUMN IF NOT EXISTS shipping_cents      INTEGER,
  ADD COLUMN IF NOT EXISTS taxes_cents         INTEGER,
  -- Content / logistics
  ADD COLUMN IF NOT EXISTS image_link          TEXT,
  ADD COLUMN IF NOT EXISTS item_description    TEXT,
  ADD COLUMN IF NOT EXISTS sell_site_location  TEXT,
  ADD COLUMN IF NOT EXISTS measurements        TEXT;

-- Non-negative money constraints
ALTER TABLE products
  ADD CONSTRAINT products_cog_nonnegative
    CHECK (cog_cents IS NULL OR cog_cents >= 0),
  ADD CONSTRAINT products_final_sales_price_nonnegative
    CHECK (final_sales_price_cents IS NULL OR final_sales_price_cents >= 0),
  ADD CONSTRAINT products_shipping_nonnegative
    CHECK (shipping_cents IS NULL OR shipping_cents >= 0),
  ADD CONSTRAINT products_taxes_nonnegative
    CHECK (taxes_cents IS NULL OR taxes_cents >= 0);
