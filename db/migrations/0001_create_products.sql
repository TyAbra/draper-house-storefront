CREATE TABLE IF NOT EXISTS products (
  id BIGSERIAL PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  price_cents INTEGER NOT NULL CHECK (price_cents >= 0),
  currency CHAR(3) NOT NULL DEFAULT 'USD',
  inventory_quantity SMALLINT NOT NULL DEFAULT 1 CHECK (inventory_quantity IN (0, 1)),
  status TEXT NOT NULL CHECK (status IN ('ACTIVE', 'SOLD')),
  sold_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT products_inventory_status_consistent CHECK (
    (status = 'ACTIVE' AND inventory_quantity = 1 AND sold_at IS NULL)
    OR
    (status = 'SOLD' AND inventory_quantity = 0 AND sold_at IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_products_status ON products (status);
CREATE INDEX IF NOT EXISTS idx_products_created_at ON products (created_at DESC);
