-- Current schema snapshot for Draper House storefront.

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

CREATE TABLE IF NOT EXISTS product_images (
  id BIGSERIAL PRIMARY KEY,
  product_id BIGINT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  alt_text TEXT,
  position INTEGER NOT NULL CHECK (position >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (product_id, position)
);

CREATE INDEX IF NOT EXISTS idx_product_images_product_id ON product_images (product_id);

CREATE TABLE IF NOT EXISTS orders (
  id BIGSERIAL PRIMARY KEY,
  status TEXT NOT NULL CHECK (status IN ('PENDING', 'PAID', 'FAILED', 'CANCELED', 'REFUNDED')),
  stripe_checkout_session_id TEXT NOT NULL UNIQUE,
  stripe_payment_intent_id TEXT UNIQUE,
  buyer_email TEXT,
  subtotal_cents INTEGER NOT NULL CHECK (subtotal_cents >= 0),
  total_cents INTEGER NOT NULL CHECK (total_cents >= 0),
  currency CHAR(3) NOT NULL DEFAULT 'USD',
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT orders_paid_at_consistent CHECK (
    (status = 'PAID' AND paid_at IS NOT NULL)
    OR
    (status <> 'PAID' AND paid_at IS NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_orders_status ON orders (status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders (created_at DESC);

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

CREATE TABLE IF NOT EXISTS processed_stripe_events (
  id BIGSERIAL PRIMARY KEY,
  stripe_event_id TEXT NOT NULL UNIQUE,
  event_type TEXT NOT NULL,
  livemode BOOLEAN NOT NULL DEFAULT FALSE,
  processing_status TEXT NOT NULL CHECK (processing_status IN ('PROCESSING', 'PROCESSED', 'FAILED')),
  error_message TEXT,
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_processed_stripe_events_received_at
  ON processed_stripe_events (received_at DESC);
CREATE INDEX IF NOT EXISTS idx_processed_stripe_events_processing_status
  ON processed_stripe_events (processing_status);
