CREATE TABLE IF NOT EXISTS order_items (
  id BIGSERIAL PRIMARY KEY,
  order_id BIGINT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id BIGINT NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  quantity SMALLINT NOT NULL DEFAULT 1 CHECK (quantity = 1),
  unit_price_cents INTEGER NOT NULL CHECK (unit_price_cents >= 0),
  currency CHAR(3) NOT NULL DEFAULT 'USD',
  -- Denormalized payment state for DB-level oversell protection.
  -- We cannot directly index on parent orders.status in a partial unique index,
  -- so webhook/order-finalization logic must set this to true atomically when the
  -- order becomes PAID.
  paid BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (order_id, product_id)
);

CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items (order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_product_id ON order_items (product_id);

-- Oversell protection: at most one paid order item per product across all orders.
CREATE UNIQUE INDEX IF NOT EXISTS idx_order_items_one_paid_per_product
  ON order_items (product_id)
  WHERE paid = TRUE;
