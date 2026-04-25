-- =============================================================================
-- Paladeium — PostgreSQL Database Schema
-- Version: 1.0 | Date: 2026-04-25
--
-- Extensions required:
--   CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
--   CREATE EXTENSION IF NOT EXISTS "timescaledb";
--   CREATE EXTENSION IF NOT EXISTS "pg_trgm";
-- =============================================================================

-- -----------------------------------------------------------------------------
-- ENUMS
-- -----------------------------------------------------------------------------

CREATE TYPE restaurant_status AS ENUM (
  'pending_approval',
  'active',
  'suspended',
  'deleted'
);

CREATE TYPE restaurant_plan AS ENUM (
  'basic',
  'pro',
  'enterprise'
);

CREATE TYPE table_status AS ENUM (
  'empty',
  'occupied',
  'bill_requested',
  'reserved'
);

CREATE TYPE order_status AS ENUM (
  'pending_payment',
  'confirmed',
  'accepted',
  'preparing',
  'ready',
  'delivered',
  'cancelled'
);

CREATE TYPE payment_method AS ENUM (
  'upi',
  'card',
  'wallet',
  'netbanking',
  'cash',
  'upi_qr_offline'
);

CREATE TYPE payment_status AS ENUM (
  'pending',
  'paid',
  'failed',
  'refunded'
);

CREATE TYPE staff_role AS ENUM (
  'owner',
  'manager',
  'waiter',
  'cashier',
  'kitchen'
);

CREATE TYPE job_status AS ENUM (
  'queued',
  'active',
  'completed',
  'failed'
);

CREATE TYPE dietary_tag AS ENUM (
  'veg',
  'vegan',
  'non-veg',
  'contains-egg',
  'gluten-free',
  'dairy-free',
  'jain'
);

-- -----------------------------------------------------------------------------
-- RESTAURANTS
-- -----------------------------------------------------------------------------

CREATE TABLE restaurants (
  id                UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  name              TEXT          NOT NULL,
  slug              TEXT          NOT NULL UNIQUE,
  address           TEXT,
  city              TEXT,
  state             TEXT,
  pincode           TEXT,
  gst_number        TEXT,
  bank_account      TEXT,
  ifsc_code         TEXT,
  owner_email       TEXT          NOT NULL,
  owner_phone       TEXT,
  logo_url          TEXT,
  targets_url       TEXT,                         -- .mind file CDN URL
  anchor_url        TEXT,                         -- source anchor image CDN URL
  currency          TEXT          NOT NULL DEFAULT 'INR',
  status            restaurant_status NOT NULL DEFAULT 'pending_approval',
  plan              restaurant_plan   NOT NULL DEFAULT 'basic',
  plan_expires_at   TIMESTAMPTZ,
  settings          JSONB         NOT NULL DEFAULT '{}',
                                                  -- { cash_enabled, upi_qr_enabled, tax_rate, ... }
  created_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  deleted_at        TIMESTAMPTZ
);

CREATE INDEX idx_restaurants_slug      ON restaurants (slug);
CREATE INDEX idx_restaurants_status    ON restaurants (status);
CREATE INDEX idx_restaurants_deleted   ON restaurants (deleted_at) WHERE deleted_at IS NULL;

-- -----------------------------------------------------------------------------
-- RESTAURANT STAFF
-- -----------------------------------------------------------------------------

CREATE TABLE restaurant_staff (
  id              UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  restaurant_id   UUID          NOT NULL REFERENCES restaurants (id) ON DELETE CASCADE,
  clerk_user_id   TEXT          NOT NULL UNIQUE,  -- Clerk user ID
  name            TEXT          NOT NULL,
  email           TEXT          NOT NULL,
  phone           TEXT,
  role            staff_role    NOT NULL,
  pin             TEXT,                            -- 4-digit PIN hash (bcrypt) for quick switch
  active          BOOLEAN       NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_staff_restaurant     ON restaurant_staff (restaurant_id);
CREATE INDEX idx_staff_clerk_user_id  ON restaurant_staff (clerk_user_id);

-- -----------------------------------------------------------------------------
-- TABLES (dining tables)
-- -----------------------------------------------------------------------------

CREATE TABLE restaurant_tables (
  id              UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  restaurant_id   UUID          NOT NULL REFERENCES restaurants (id) ON DELETE CASCADE,
  number          TEXT          NOT NULL,          -- e.g. "T1", "T2", "Bar-1"
  label           TEXT,                            -- e.g. "Window Table", "Private Room"
  capacity        INT,
  status          table_status  NOT NULL DEFAULT 'empty',
  qr_code_url     TEXT,                            -- QR image CDN URL
  ar_url          TEXT,                            -- https://paladeium.app/r/slug?table=T1
  position_x      FLOAT,                           -- For visual table map
  position_y      FLOAT,
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  UNIQUE (restaurant_id, number)
);

CREATE INDEX idx_tables_restaurant ON restaurant_tables (restaurant_id);

-- -----------------------------------------------------------------------------
-- MENU CATEGORIES
-- -----------------------------------------------------------------------------

CREATE TABLE menu_categories (
  id              UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  restaurant_id   UUID          NOT NULL REFERENCES restaurants (id) ON DELETE CASCADE,
  name            TEXT          NOT NULL,
  emoji           TEXT,
  sort_order      INT           NOT NULL DEFAULT 0,
  available       BOOLEAN       NOT NULL DEFAULT true,
  available_from  TIME,                            -- e.g. 07:00 for breakfast
  available_until TIME,                            -- e.g. 11:00 for breakfast
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_categories_restaurant ON menu_categories (restaurant_id, sort_order);

-- -----------------------------------------------------------------------------
-- MENU ITEMS
-- -----------------------------------------------------------------------------

CREATE TABLE menu_items (
  id              UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  restaurant_id   UUID          NOT NULL REFERENCES restaurants (id) ON DELETE CASCADE,
  category_id     UUID          NOT NULL REFERENCES menu_categories (id) ON DELETE RESTRICT,
  name            TEXT          NOT NULL,
  description     TEXT,
  price           NUMERIC(10,2) NOT NULL,
  emoji           TEXT,
  image_url       TEXT,
  model_url       TEXT,                            -- .glb CDN URL (null if no AR)
  has_ar          BOOLEAN       NOT NULL DEFAULT false,
  dietary_tags    dietary_tag[] NOT NULL DEFAULT '{}',
  allergens       TEXT[]        NOT NULL DEFAULT '{}',
  sort_order      INT           NOT NULL DEFAULT 0,
  available       BOOLEAN       NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  deleted_at      TIMESTAMPTZ
);

CREATE INDEX idx_items_restaurant     ON menu_items (restaurant_id);
CREATE INDEX idx_items_category       ON menu_items (category_id);
CREATE INDEX idx_items_deleted        ON menu_items (deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX idx_items_search         ON menu_items USING gin (name gin_trgm_ops);

-- -----------------------------------------------------------------------------
-- ORDERS
-- -----------------------------------------------------------------------------

CREATE TABLE orders (
  id                UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  restaurant_id     UUID          NOT NULL REFERENCES restaurants (id),
  table_id          UUID          REFERENCES restaurant_tables (id),
  table_number      TEXT,                          -- Denormalised for quick display
  order_number      TEXT          NOT NULL,         -- e.g. "ORD-0042" (per-restaurant sequence)
  idempotency_key   TEXT          NOT NULL UNIQUE,  -- Client-generated UUID (offline safety)
  status            order_status  NOT NULL DEFAULT 'pending_payment',
  source            TEXT          NOT NULL DEFAULT 'customer_ar',
                                                   -- 'customer_ar' | 'pos_manual' | 'offline_sync'
  subtotal          NUMERIC(10,2) NOT NULL,
  discount_amount   NUMERIC(10,2) NOT NULL DEFAULT 0,
  discount_label    TEXT,
  tax_rate          NUMERIC(5,2)  NOT NULL DEFAULT 5.00,
  tax_amount        NUMERIC(10,2) NOT NULL,
  total             NUMERIC(10,2) NOT NULL,
  special_notes     TEXT,
  accepted_at       TIMESTAMPTZ,
  prepared_at       TIMESTAMPTZ,
  ready_at          TIMESTAMPTZ,
  delivered_at      TIMESTAMPTZ,
  cancelled_at      TIMESTAMPTZ,
  cancel_reason     TEXT,
  synced_at         TIMESTAMPTZ,                   -- When offline order was synced
  created_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_orders_restaurant  ON orders (restaurant_id, created_at DESC);
CREATE INDEX idx_orders_table       ON orders (table_id);
CREATE INDEX idx_orders_status      ON orders (restaurant_id, status);
CREATE INDEX idx_orders_idem_key    ON orders (idempotency_key);
CREATE INDEX idx_orders_date        ON orders (restaurant_id, (created_at::date));

-- Per-restaurant auto-incrementing order number
CREATE SEQUENCE order_number_seq;

CREATE OR REPLACE FUNCTION set_order_number()
RETURNS TRIGGER AS $$
BEGIN
  NEW.order_number := 'ORD-' || LPAD(nextval('order_number_seq')::TEXT, 4, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_order_number
  BEFORE INSERT ON orders
  FOR EACH ROW EXECUTE FUNCTION set_order_number();

-- -----------------------------------------------------------------------------
-- ORDER ITEMS
-- -----------------------------------------------------------------------------

CREATE TABLE order_items (
  id                  UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id            UUID          NOT NULL REFERENCES orders (id) ON DELETE CASCADE,
  menu_item_id        UUID          REFERENCES menu_items (id) ON DELETE SET NULL,
  name                TEXT          NOT NULL,       -- Denormalised (menu item may change)
  price               NUMERIC(10,2) NOT NULL,       -- Price at time of order
  quantity            INT           NOT NULL DEFAULT 1,
  special_instructions TEXT,
  created_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_order_items_order ON order_items (order_id);

-- -----------------------------------------------------------------------------
-- PAYMENTS
-- -----------------------------------------------------------------------------

CREATE TABLE payments (
  id                    UUID            PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id              UUID            NOT NULL REFERENCES orders (id),
  restaurant_id         UUID            NOT NULL REFERENCES restaurants (id),
  method                payment_method  NOT NULL,
  status                payment_status  NOT NULL DEFAULT 'pending',
  amount                NUMERIC(10,2)   NOT NULL,
  currency              TEXT            NOT NULL DEFAULT 'INR',
  razorpay_order_id     TEXT,
  razorpay_payment_id   TEXT,
  razorpay_signature    TEXT,
  gateway_response      JSONB,
  refund_amount         NUMERIC(10,2),
  refund_reason         TEXT,
  refunded_at           TIMESTAMPTZ,
  created_at            TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_payments_order       ON payments (order_id);
CREATE INDEX idx_payments_restaurant  ON payments (restaurant_id, created_at DESC);
CREATE INDEX idx_payments_razorpay    ON payments (razorpay_payment_id);

-- -----------------------------------------------------------------------------
-- BACKGROUND JOBS
-- -----------------------------------------------------------------------------

CREATE TABLE jobs (
  id              UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  type            TEXT        NOT NULL,             -- 'compile-targets' | 'qr-generator' | etc.
  restaurant_id   UUID        REFERENCES restaurants (id),
  status          job_status  NOT NULL DEFAULT 'queued',
  payload         JSONB       NOT NULL DEFAULT '{}',
  result          JSONB,
  error           TEXT,
  attempts        INT         NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  started_at      TIMESTAMPTZ,
  completed_at    TIMESTAMPTZ
);

CREATE INDEX idx_jobs_restaurant ON jobs (restaurant_id);
CREATE INDEX idx_jobs_status     ON jobs (status);

-- -----------------------------------------------------------------------------
-- EVENTS (TimescaleDB hypertable for analytics)
-- -----------------------------------------------------------------------------

CREATE TABLE events (
  id              UUID        NOT NULL DEFAULT uuid_generate_v4(),
  restaurant_id   UUID        NOT NULL REFERENCES restaurants (id),
  event_type      TEXT        NOT NULL,
  session_id      TEXT,                             -- Client-generated anonymous session UUID
  order_id        UUID        REFERENCES orders (id),
  menu_item_id    UUID        REFERENCES menu_items (id),
  table_number    TEXT,
  properties      JSONB       NOT NULL DEFAULT '{}',
  device_type     TEXT,                             -- 'ios' | 'android' | 'windows'
  ts              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (id, ts)
);

-- Convert to TimescaleDB hypertable (partitioned by ts, 1-week chunks)
SELECT create_hypertable('events', 'ts', chunk_time_interval => INTERVAL '1 week');

CREATE INDEX idx_events_restaurant  ON events (restaurant_id, ts DESC);
CREATE INDEX idx_events_type        ON events (restaurant_id, event_type, ts DESC);
CREATE INDEX idx_events_session     ON events (session_id, ts DESC);

-- Continuous aggregate: hourly order counts per restaurant (for peak hours heatmap)
CREATE MATERIALIZED VIEW hourly_order_counts
WITH (timescaledb.continuous) AS
SELECT
  restaurant_id,
  time_bucket('1 hour', ts)   AS hour,
  COUNT(*)                     AS event_count
FROM events
WHERE event_type = 'order_placed'
GROUP BY restaurant_id, hour;

SELECT add_continuous_aggregate_policy('hourly_order_counts',
  start_offset   => INTERVAL '3 days',
  end_offset     => INTERVAL '1 hour',
  schedule_interval => INTERVAL '1 hour'
);

-- Retention policy: keep raw events for 12 months
SELECT add_retention_policy('events', INTERVAL '12 months');

-- -----------------------------------------------------------------------------
-- ROW-LEVEL SECURITY
-- -----------------------------------------------------------------------------

ALTER TABLE restaurants       ENABLE ROW LEVEL SECURITY;
ALTER TABLE restaurant_tables ENABLE ROW LEVEL SECURITY;
ALTER TABLE restaurant_staff  ENABLE ROW LEVEL SECURITY;
ALTER TABLE menu_categories   ENABLE ROW LEVEL SECURITY;
ALTER TABLE menu_items        ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders            ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items       ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments          ENABLE ROW LEVEL SECURITY;
ALTER TABLE events            ENABLE ROW LEVEL SECURITY;

-- Restaurants see only their own data
CREATE POLICY restaurant_self_access ON restaurants
  USING (id = current_setting('app.current_restaurant_id', true)::uuid
      OR current_setting('app.role', true) = 'paladeium_admin');

CREATE POLICY restaurant_tables_access ON restaurant_tables
  USING (restaurant_id = current_setting('app.current_restaurant_id', true)::uuid
      OR current_setting('app.role', true) = 'paladeium_admin');

CREATE POLICY menu_items_access ON menu_items
  USING (restaurant_id = current_setting('app.current_restaurant_id', true)::uuid
      OR current_setting('app.role', true) = 'paladeium_admin');

CREATE POLICY orders_access ON orders
  USING (restaurant_id = current_setting('app.current_restaurant_id', true)::uuid
      OR current_setting('app.role', true) = 'paladeium_admin');

CREATE POLICY payments_access ON payments
  USING (restaurant_id = current_setting('app.current_restaurant_id', true)::uuid
      OR current_setting('app.role', true) = 'paladeium_admin');

CREATE POLICY events_access ON events
  USING (restaurant_id = current_setting('app.current_restaurant_id', true)::uuid
      OR current_setting('app.role', true) = 'paladeium_admin');

-- Public read for menu (no RLS bypass needed — handled in app layer by public role)
CREATE POLICY menu_items_public_read ON menu_items
  FOR SELECT USING (available = true AND deleted_at IS NULL);

-- -----------------------------------------------------------------------------
-- UPDATED_AT TRIGGERS
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_restaurants_updated_at
  BEFORE UPDATE ON restaurants
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_staff_updated_at
  BEFORE UPDATE ON restaurant_staff
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_tables_updated_at
  BEFORE UPDATE ON restaurant_tables
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_categories_updated_at
  BEFORE UPDATE ON menu_categories
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_items_updated_at
  BEFORE UPDATE ON menu_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_orders_updated_at
  BEFORE UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_payments_updated_at
  BEFORE UPDATE ON payments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- -----------------------------------------------------------------------------
-- SAMPLE DATA (dev seed — remove before production)
-- -----------------------------------------------------------------------------

INSERT INTO restaurants (id, name, slug, address, city, owner_email, status, plan)
VALUES (
  'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  'The Grand Spice',
  'the-grand-spice',
  '12 MG Road',
  'Bangalore',
  'owner@grandspice.com',
  'active',
  'pro'
);

INSERT INTO restaurant_tables (restaurant_id, number, label, capacity)
VALUES
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'T1', 'Window Table', 4),
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'T2', 'Centre Table', 6),
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'T3', 'Booth', 2),
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Bar-1', 'Bar Seat', 1);

INSERT INTO menu_categories (id, restaurant_id, name, emoji, sort_order)
VALUES
  ('b1eebc99-9c0b-4ef8-bb6d-6bb9bd380b22', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Starters', '🥗', 1),
  ('b2eebc99-9c0b-4ef8-bb6d-6bb9bd380b33', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Mains',    '🍽', 2),
  ('b3eebc99-9c0b-4ef8-bb6d-6bb9bd380b44', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Drinks',   '🍹', 3),
  ('b4eebc99-9c0b-4ef8-bb6d-6bb9bd380b55', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Desserts', '🍰', 4);

INSERT INTO menu_items (restaurant_id, category_id, name, description, price, emoji, has_ar, dietary_tags)
VALUES
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'b2eebc99-9c0b-4ef8-bb6d-6bb9bd380b33',
   'Wagyu Smash Burger', 'Double patty, aged cheddar, truffle aioli', 649, '🍔', true,  '{non-veg}'),
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'b2eebc99-9c0b-4ef8-bb6d-6bb9bd380b33',
   'Margherita Classico', 'San Marzano, buffalo mozzarella, fresh basil', 549, '🍕', false, '{veg}'),
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'b2eebc99-9c0b-4ef8-bb6d-6bb9bd380b33',
   'Cacio e Pepe',       'Spaghetti, pecorino, black pepper',           499, '🍝', false, '{veg}'),
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380b22',
   'Caesar Deluxe',      'Romaine, parmesan, anchovy dressing',          349, '🥗', false, '{non-veg}'),
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'b3eebc99-9c0b-4ef8-bb6d-6bb9bd380b44',
   'Virgin Mojito',      'Fresh mint, lime, soda',                       199, '🍹', false, '{veg, vegan}'),
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'b4eebc99-9c0b-4ef8-bb6d-6bb9bd380b55',
   'Chocolate Lava Cake','Warm chocolate centre, vanilla ice cream',      329, '🍫', false, '{veg}');
