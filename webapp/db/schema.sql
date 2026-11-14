-- Epic Cure MTG — schema (PostgreSQL 14+)
-- Run: npm run db:schema
-- Idempotent: safe to re-run against an existing database.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ---------------------------------------------------------------- clients (PHI)
CREATE TABLE IF NOT EXISTS clients (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_token_hash     text UNIQUE NOT NULL,        -- HMAC of the printed MTG token; raw tokens are never stored
  full_name_enc         bytea NOT NULL,              -- AES-256-GCM envelope
  household_size        smallint NOT NULL DEFAULT 1 CHECK (household_size BETWEEN 1 AND 12),
  enrollment_status     text NOT NULL DEFAULT 'active' CHECK (enrollment_status IN ('active', 'expired', 'pending')),
  enrollment_expires_on date,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS condition_catalog (
  code          text PRIMARY KEY,                    -- ICD-10
  name          text NOT NULL,
  condition_key text NOT NULL                        -- diabetes | hypertension | ckd | heart_failure
);

CREATE TABLE IF NOT EXISTS client_conditions (
  client_id      uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  condition_code text NOT NULL REFERENCES condition_catalog(code),
  PRIMARY KEY (client_id, condition_code)
);

CREATE TABLE IF NOT EXISTS client_allergies (
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  allergen  text NOT NULL,
  PRIMARY KEY (client_id, allergen)
);

-- ---------------------------------------------------------------- clinical matrix
CREATE TABLE IF NOT EXISTS dietary_tiers (
  id           text PRIMARY KEY,
  label        text NOT NULL,
  coefficients jsonb NOT NULL,                       -- lb per person per visit, by category
  notes        text
);

-- Bound at enrollment (US-2.1) and refreshed when conditions change.
ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS dietary_tier_id text REFERENCES dietary_tiers(id);

-- Reporting mirror of src/services/dietaryMatrix.js (code is authoritative at runtime).
CREATE TABLE IF NOT EXISTS dietary_rules (
  id          text PRIMARY KEY,
  condition_key text NOT NULL,
  item_tag    text,
  nutrient    text,
  operator    text CHECK (operator IN ('>', '>=', '<', '<=', '=')),
  threshold   numeric,
  status      text NOT NULL CHECK (status IN ('approved', 'capped', 'restricted')),
  cap_servings numeric,
  rationale   text NOT NULL
);

-- ---------------------------------------------------------------- catalog & stock
CREATE TABLE IF NOT EXISTS products (  sku            text PRIMARY KEY,
  name           text NOT NULL,
  brand          text,
  category       text NOT NULL CHECK (category IN ('produce', 'protein', 'dairy', 'grain', 'pantry')),
  aisle          text NOT NULL,
  shelf          text NOT NULL,
  bin            text NOT NULL,
  serving_size_g numeric NOT NULL,
  calories       numeric,
  protein_g      numeric,
  carbs_g        numeric,
  fiber_g        numeric,
  sugar_g        numeric,
  fat_g          numeric,
  sat_fat_g      numeric,
  sodium_mg      numeric,
  potassium_mg   numeric,
  phosphorus_mg  numeric,
  glycemic_index numeric,
  allergens      text[] NOT NULL DEFAULT '{}',
  tags           text[] NOT NULL DEFAULT '{}',
  is_active      boolean NOT NULL DEFAULT true
);

CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);

CREATE TABLE IF NOT EXISTS grants (
  id           text PRIMARY KEY,
  funder       text NOT NULL,
  grant_code   text NOT NULL,
  period_start date,
  period_end   date
);

CREATE TABLE IF NOT EXISTS inventory_lots (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sku                text NOT NULL REFERENCES products(sku),
  lot_code           text NOT NULL,
  quantity_remaining integer NOT NULL DEFAULT 0 CHECK (quantity_remaining >= 0),
  received_on        date NOT NULL DEFAULT CURRENT_DATE,
  expires_on         date,
  grant_id           text REFERENCES grants(id),
  UNIQUE (sku, lot_code)
);

CREATE INDEX IF NOT EXISTS idx_lots_expiry ON inventory_lots(expires_on) WHERE quantity_remaining > 0;

CREATE TABLE IF NOT EXISTS shelf_stock (
  sku          text PRIMARY KEY REFERENCES products(sku),
  on_hand      integer NOT NULL DEFAULT 0 CHECK (on_hand >= 0),
  min_threshold integer NOT NULL DEFAULT 5,
  updated_at   timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------- sessions & flow
CREATE TABLE IF NOT EXISTS floor_state (
  id                    smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  active_floor_shoppers integer NOT NULL DEFAULT 0 CHECK (active_floor_shoppers >= 0),
  max_floor_capacity    integer NOT NULL DEFAULT 25 CHECK (max_floor_capacity > 0)
);

CREATE TABLE IF NOT EXISTS shopping_sessions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id       uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  session_token   text UNIQUE NOT NULL,
  status          text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'queue_waiting', 'completed', 'abandoned')),
  queue_position  integer,
  dietary_tier_id text REFERENCES dietary_tiers(id),
  started_at      timestamptz NOT NULL DEFAULT now(),
  ended_at        timestamptz
);

CREATE INDEX IF NOT EXISTS idx_sessions_status ON shopping_sessions(status, started_at);

-- Heartbeat for the floor/queue: shoppers who walk away without checking out (or close the
-- waiting page) are expired automatically so their floor slot or place in line is released.
ALTER TABLE shopping_sessions ADD COLUMN IF NOT EXISTS last_seen_at timestamptz NOT NULL DEFAULT now();
CREATE INDEX IF NOT EXISTS idx_sessions_seen ON shopping_sessions(status, last_seen_at);

CREATE TABLE IF NOT EXISTS cart_items (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id       uuid NOT NULL REFERENCES shopping_sessions(id) ON DELETE CASCADE,
  sku              text NOT NULL REFERENCES products(sku),
  quantity         integer NOT NULL DEFAULT 1 CHECK (quantity > 0),
  evaluated_status text NOT NULL DEFAULT 'approved' CHECK (evaluated_status IN ('approved', 'capped', 'restricted')),
  added_at         timestamptz NOT NULL DEFAULT now(),
  UNIQUE (session_id, sku)
);

-- ---------------------------------------------------------------- checkout ledger
CREATE TABLE IF NOT EXISTS checkout_transactions (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id       uuid NOT NULL REFERENCES shopping_sessions(id),
  acted_by         text NOT NULL DEFAULT 'volunteer',
  total_weight_lbs numeric(10, 3) NOT NULL DEFAULT 0,
  item_count       integer NOT NULL DEFAULT 0,
  created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS checkout_lines (
  id               bigserial PRIMARY KEY,
  transaction_id   uuid NOT NULL REFERENCES checkout_transactions(id) ON DELETE CASCADE,
  sku              text NOT NULL REFERENCES products(sku),
  quantity         integer NOT NULL,
  weight_lbs       numeric(10, 3) NOT NULL DEFAULT 0,
  evaluated_status text NOT NULL CHECK (evaluated_status IN ('approved', 'capped', 'restricted')),
  grant_id         text REFERENCES grants(id)
);

CREATE INDEX IF NOT EXISTS idx_checkout_lines_tx ON checkout_lines(transaction_id);

-- ---------------------------------------------------------------- AI observability
CREATE TABLE IF NOT EXISTS ai_inference_log (
  id         bigserial PRIMARY KEY,
  session_id uuid,
  kind       text NOT NULL,
  latency_ms integer,
  ok         boolean NOT NULL DEFAULT false,
  payload    jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------- de-identified analytics
-- No client id, token, name, or exact visit timestamp in this view.
CREATE OR REPLACE VIEW analytics_distribution AS
SELECT date_trunc('month', ct.created_at) AS month,
       p.category,
       cl.evaluated_status,
       SUM(cl.quantity)::int  AS units,
       SUM(cl.weight_lbs)     AS weight_lbs
  FROM checkout_lines cl
  JOIN checkout_transactions ct ON ct.id = cl.transaction_id
  JOIN products p ON p.sku = cl.sku
 GROUP BY 1, 2, 3;

-- ---------------------------------------------------------------- biometric tracking (US-5.1)
-- Readings are keyed only by the client's random uuid (no name/token). Values stay numeric so
-- the analytics layer can aggregate them; identity lives in the encrypted clients table.
CREATE TABLE IF NOT EXISTS client_biometrics (
  id          bigserial PRIMARY KEY,
  client_id   uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  measured_on date NOT NULL DEFAULT CURRENT_DATE,
  a1c_pct     numeric(4, 1) CHECK (a1c_pct BETWEEN 3 AND 20),
  systolic    integer CHECK (systolic BETWEEN 60 AND 260),
  diastolic   integer CHECK (diastolic BETWEEN 30 AND 160),
  egfr        numeric(5, 1) CHECK (egfr BETWEEN 1 AND 150),
  weight_lbs  numeric(5, 1) CHECK (weight_lbs BETWEEN 40 AND 700),
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_biometrics_client ON client_biometrics(client_id, measured_on);

-- De-identified grant ledger for audit export (US-5.2): one row per funder × grant × month ×
-- category × clinical status. No client, session, or transaction identifiers.
CREATE OR REPLACE VIEW analytics_grant_ledger AS
SELECT date_trunc('month', ct.created_at)::date AS month,
       COALESCE(g.funder, 'Unattributed')        AS funder,
       COALESCE(g.grant_code, 'n/a')             AS grant_code,
       p.category,
       cl.evaluated_status,
       SUM(cl.quantity)::int                     AS units,
       SUM(cl.weight_lbs)::numeric(12, 3)        AS weight_lbs
  FROM checkout_lines cl
  JOIN checkout_transactions ct ON ct.id = cl.transaction_id
  JOIN products p ON p.sku = cl.sku
  LEFT JOIN grants g ON g.id = cl.grant_id
 GROUP BY 1, 2, 3, 4, 5;

-- Pounds by clinical condition group × food category. A household with several conditions
-- counts toward each of its condition groups (documented in the export header).
CREATE OR REPLACE VIEW analytics_condition_distribution AS
SELECT date_trunc('month', ct.created_at)::date AS month,
       cc2.condition_key,
       p.category,
       SUM(cl.quantity)::int                     AS units,
       SUM(cl.weight_lbs)::numeric(12, 3)        AS weight_lbs
  FROM checkout_lines cl
  JOIN checkout_transactions ct ON ct.id = cl.transaction_id
  JOIN shopping_sessions s ON s.id = ct.session_id
  JOIN products p ON p.sku = cl.sku
  JOIN (SELECT DISTINCT c.client_id, cat.condition_key
          FROM client_conditions c
          JOIN condition_catalog cat ON cat.code = c.condition_code) cc2 ON cc2.client_id = s.client_id
 GROUP BY 1, 2, 3;

-- ---------------------------------------------------------------- express-session store
CREATE TABLE IF NOT EXISTS "session" (
  "sid"    varchar NOT NULL COLLATE "default",
  "sess"   json NOT NULL,
  "expire" timestamp(6) NOT NULL,
  CONSTRAINT "session_pkey" PRIMARY KEY ("sid")
);

CREATE INDEX IF NOT EXISTS "IDX_session_expire" ON "session" ("expire");

COMMIT;
