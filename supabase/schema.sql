-- ============================================================
-- Paladeium – Full Supabase Schema
-- ============================================================
-- Run this once in your Supabase SQL editor.
-- All tables use UUID PKs. RLS is enabled where appropriate.
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ── COMPANIES (super-admin multi-tenant) ─────────────────────
CREATE TABLE IF NOT EXISTS companies (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name        TEXT NOT NULL,
  slug        TEXT UNIQUE NOT NULL,
  plan        TEXT NOT NULL DEFAULT 'starter'
                CHECK (plan IN ('free','starter','pro','enterprise')),
  monthly_fee DECIMAL(10,2) DEFAULT 3500,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── RESTAURANTS ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS restaurants (
  id                        UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id                UUID REFERENCES companies(id) ON DELETE SET NULL,
  name                      TEXT NOT NULL,
  slug                      TEXT UNIQUE NOT NULL,
  description               TEXT DEFAULT '',
  status                    TEXT NOT NULL DEFAULT 'active'
                              CHECK (status IN ('active','inactive','pending','pendingDeletion')),
  plan                      TEXT NOT NULL DEFAULT 'starter',
  monthly_fee               DECIMAL(10,2) DEFAULT 3500,
  setup_fee                 DECIMAL(10,2) DEFAULT 0,
  ui_type                   TEXT NOT NULL DEFAULT 'dynamic'
                              CHECK (ui_type IN ('ar','dynamic')),
  payment_enabled           BOOLEAN NOT NULL DEFAULT FALSE,
  ar_overlay_enabled        BOOLEAN NOT NULL DEFAULT FALSE,
  marker_detection_enabled  BOOLEAN NOT NULL DEFAULT TRUE,
  targets_url               TEXT,
  delete_at                 TIMESTAMPTZ,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── MENU CATEGORIES ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS categories (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  emoji         TEXT DEFAULT '🍽',
  sort_order    INTEGER DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── MENU ITEMS ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS menu_items (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  category_id   UUID REFERENCES categories(id) ON DELETE SET NULL,
  name          TEXT NOT NULL,
  description   TEXT DEFAULT '',
  price         DECIMAL(10,2) NOT NULL,
  emoji         TEXT DEFAULT '🍽',
  image_url     TEXT DEFAULT '',
  model_url     TEXT DEFAULT '',
  model_scale   DECIMAL(6,3),
  has_ar        BOOLEAN NOT NULL DEFAULT FALSE,
  dietary_tags  TEXT[] DEFAULT '{}',
  available     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── ORDERS ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS orders (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  restaurant_id   UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  restaurant_slug TEXT NOT NULL,
  customer_name   TEXT,
  customer_phone  TEXT,
  customer_address TEXT,
  total           DECIMAL(10,2) NOT NULL,
  status          TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending','confirmed','preparing','ready','delivered','rejected')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── ORDER ITEMS ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS order_items (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id       UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  menu_item_id   UUID REFERENCES menu_items(id) ON DELETE SET NULL,
  item_name      TEXT NOT NULL,
  price          DECIMAL(10,2) NOT NULL,
  qty            INTEGER NOT NULL CHECK (qty > 0),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── SESSIONS (AR lens visits) ─────────────────────────────────
CREATE TABLE IF NOT EXISTS sessions (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  device_type   TEXT DEFAULT 'mobile'
                  CHECK (device_type IN ('mobile','tablet','desktop','unknown')),
  started_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at      TIMESTAMPTZ,
  duration_sec  INTEGER,                    -- computed on session_end
  page_views    INTEGER DEFAULT 0
);

-- ── EVENTS (granular tracking) ────────────────────────────────
CREATE TABLE IF NOT EXISTS events (
  id            BIGSERIAL PRIMARY KEY,
  session_id    UUID REFERENCES sessions(id) ON DELETE CASCADE,
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  menu_item_id  UUID REFERENCES menu_items(id) ON DELETE SET NULL,
  event_type    TEXT NOT NULL CHECK (event_type IN (
                  'session_start','session_end',
                  'dish_view','dish_select',
                  'ar_start','ar_rotate','ar_zoom','ar_end',
                  'add_to_cart','remove_from_cart',
                  'checkout_start','order_placed'
                )),
  properties    JSONB DEFAULT '{}',         -- extra data (qty, model_load_ms, etc.)
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── RESTAURANT USERS (role-based access) ─────────────────────
CREATE TABLE IF NOT EXISTS restaurant_users (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  email         TEXT NOT NULL,
  role          TEXT NOT NULL DEFAULT 'staff'
                  CHECK (role IN ('owner','manager','staff')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(restaurant_id, email)
);

-- ── INDEXES ──────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_events_restaurant_time  ON events(restaurant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_events_item_time        ON events(menu_item_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_events_type_time        ON events(event_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sessions_restaurant     ON sessions(restaurant_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_restaurant_time  ON orders(restaurant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_status           ON orders(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_menu_items_restaurant   ON menu_items(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_order_items_order       ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_item        ON order_items(menu_item_id);

-- ── MATERIALIZED VIEW: dish_stats ────────────────────────────
-- Refresh with: REFRESH MATERIALIZED VIEW CONCURRENTLY dish_stats;
-- Schedule with pg_cron: SELECT cron.schedule('refresh-dish-stats', '*/15 * * * *', 'REFRESH MATERIALIZED VIEW CONCURRENTLY dish_stats');

CREATE MATERIALIZED VIEW IF NOT EXISTS dish_stats AS
SELECT
  mi.id                                             AS menu_item_id,
  mi.restaurant_id,
  mi.name,
  mi.price,
  mi.emoji,
  mi.has_ar,
  mi.available,
  COUNT(DISTINCT CASE WHEN e.event_type = 'dish_view'    THEN e.session_id END) AS views,
  COUNT(DISTINCT CASE WHEN e.event_type = 'ar_start'     THEN e.session_id END) AS ar_views,
  COUNT(DISTINCT CASE WHEN e.event_type = 'add_to_cart'  THEN e.session_id END) AS cart_adds,
  COALESCE(SUM(
    CASE WHEN e.event_type = 'order_placed'
    THEN COALESCE((e.properties->>'qty')::int, 1) ELSE 0 END
  ), 0)                                             AS orders,
  COALESCE(SUM(
    CASE WHEN e.event_type = 'order_placed'
    THEN COALESCE((e.properties->>'qty')::int, 1) * mi.price ELSE 0 END
  ), 0)                                             AS revenue,
  ROUND(
    CASE
      WHEN COUNT(DISTINCT CASE WHEN e.event_type = 'dish_view' THEN e.session_id END) > 0
      THEN COUNT(DISTINCT CASE WHEN e.event_type = 'add_to_cart' THEN e.session_id END)::NUMERIC
           / COUNT(DISTINCT CASE WHEN e.event_type = 'dish_view' THEN e.session_id END) * 100
      ELSE 0
    END, 2
  )                                                 AS conversion_rate,
  ROUND(
    CASE
      WHEN COUNT(DISTINCT CASE WHEN e.event_type = 'dish_view' THEN e.session_id END) > 0
      THEN COUNT(DISTINCT CASE WHEN e.event_type = 'ar_start' THEN e.session_id END)::NUMERIC
           / COUNT(DISTINCT CASE WHEN e.event_type = 'dish_view' THEN e.session_id END) * 100
      ELSE 0
    END, 2
  )                                                 AS ar_engagement_rate
FROM menu_items mi
LEFT JOIN events e ON e.menu_item_id = mi.id
GROUP BY mi.id, mi.restaurant_id, mi.name, mi.price, mi.emoji, mi.has_ar, mi.available;

CREATE UNIQUE INDEX IF NOT EXISTS dish_stats_item_idx ON dish_stats(menu_item_id);

-- ── MATERIALIZED VIEW: restaurant_daily_stats ────────────────
CREATE MATERIALIZED VIEW IF NOT EXISTS restaurant_daily_stats AS
SELECT
  restaurant_id,
  DATE_TRUNC('day', created_at)::DATE   AS day,
  COUNT(DISTINCT session_id)            AS sessions,
  COUNT(DISTINCT CASE WHEN event_type = 'order_placed' THEN session_id END) AS conversions,
  COUNT(*) FILTER (WHERE event_type = 'ar_start')    AS ar_starts,
  COUNT(*) FILTER (WHERE event_type = 'dish_view')   AS dish_views,
  COUNT(*) FILTER (WHERE event_type = 'order_placed') AS order_events
FROM events
GROUP BY restaurant_id, DATE_TRUNC('day', created_at)::DATE;

CREATE UNIQUE INDEX IF NOT EXISTS rest_daily_idx ON restaurant_daily_stats(restaurant_id, day);

-- ── ROW LEVEL SECURITY ────────────────────────────────────────
ALTER TABLE restaurants        ENABLE ROW LEVEL SECURITY;
ALTER TABLE menu_items         ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders             ENABLE ROW LEVEL SECURITY;
ALTER TABLE events             ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions           ENABLE ROW LEVEL SECURITY;
ALTER TABLE restaurant_users   ENABLE ROW LEVEL SECURITY;

-- Public read for menu items (AR lens consumer)
CREATE POLICY "public_read_menu" ON menu_items
  FOR SELECT USING (available = true);

-- Public insert for events/sessions (AR lens tracking)
CREATE POLICY "public_insert_events"   ON events   FOR INSERT WITH CHECK (true);
CREATE POLICY "public_insert_sessions" ON sessions FOR INSERT WITH CHECK (true);
CREATE POLICY "public_update_sessions" ON sessions FOR UPDATE USING (true);

-- Public insert for orders (from AR lens checkout)
CREATE POLICY "public_insert_orders"       ON orders      FOR INSERT WITH CHECK (true);
CREATE POLICY "public_insert_order_items"  ON order_items FOR INSERT WITH CHECK (true);

-- Service role has full access (used by dashboard API with service key)
-- Service key bypasses RLS by default, so no explicit policy needed there.

-- ── HELPER FUNCTIONS ─────────────────────────────────────────

-- Compute dish score (0–100)
CREATE OR REPLACE FUNCTION compute_dish_score(
  p_orders         NUMERIC,
  p_views          NUMERIC,
  p_conversion     NUMERIC,
  p_ar_engagement  NUMERIC,
  p_max_orders     NUMERIC DEFAULT 500
)
RETURNS NUMERIC AS $$
BEGIN
  RETURN LEAST(100, ROUND(
    0.4 * LEAST(100, p_orders / NULLIF(p_max_orders, 0) * 100) +
    0.3 * p_conversion +
    0.2 * p_ar_engagement +
    0.1 * LEAST(100, p_views / 10)
  , 0));
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ── UPDATED_AT TRIGGER ────────────────────────────────────────
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER restaurants_updated_at BEFORE UPDATE ON restaurants
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER menu_items_updated_at BEFORE UPDATE ON menu_items
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER orders_updated_at BEFORE UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
