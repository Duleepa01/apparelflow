CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('cutting_supervisor','cutting_verifier','sewing_supervisor')),
  full_name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS recipes (
  id SERIAL PRIMARY KEY,
  recipe_code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  std_fabric_yards NUMERIC(8,2) NOT NULL CHECK (std_fabric_yards > 0),
  wastage_cap NUMERIC(5,2) NOT NULL CHECK (wastage_cap >= 0)
);

CREATE TABLE IF NOT EXISTS recipe_components (
  id SERIAL PRIMARY KEY,
  recipe_id INT NOT NULL REFERENCES recipes(id),
  component_name TEXT NOT NULL,
  pieces_per_garment INT NOT NULL CHECK (pieces_per_garment > 0),
  image_url TEXT,
  UNIQUE (recipe_id, component_name)
);

CREATE TABLE IF NOT EXISTS cutting_orders (
  id SERIAL PRIMARY KEY,
  order_no TEXT NOT NULL UNIQUE,
  recipe_id INT NOT NULL REFERENCES recipes(id),
  target_qty INT NOT NULL CHECK (target_qty > 0),
  fabric_roll_id TEXT NOT NULL CHECK (length(trim(fabric_roll_id)) > 0),
  actual_fabric_yds NUMERIC(10,2) NOT NULL CHECK (actual_fabric_yds > 0),
  status TEXT NOT NULL CHECK (status IN
    ('CUTTING_IN_PROGRESS','PENDING_VERIFICATION','REJECTED','VERIFIED','SEWING_STARTED')),
  created_by INT NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS verification_items (
  id SERIAL PRIMARY KEY,
  order_id INT NOT NULL REFERENCES cutting_orders(id),
  component_id INT NOT NULL REFERENCES recipe_components(id),
  expected_qty INT NOT NULL CHECK (expected_qty > 0),
  actual_qty INT CHECK (actual_qty >= 0),
  status TEXT CHECK (status IN ('GREEN','YELLOW','RED')),
  UNIQUE (order_id, component_id)
);

CREATE TABLE IF NOT EXISTS verification_logs (
  id SERIAL PRIMARY KEY,
  order_id INT NOT NULL REFERENCES cutting_orders(id),
  verifier_id INT NOT NULL REFERENCES users(id),
  decision TEXT NOT NULL CHECK (decision IN ('APPROVED','REJECTED')),
  rejection_note TEXT,
  wastage_pct NUMERIC(7,2),
  variances JSONB,
  decided_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (decision <> 'REJECTED' OR length(trim(coalesce(rejection_note,''))) > 0)
);

CREATE OR REPLACE FUNCTION forbid_log_changes() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'verification_logs is immutable';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS verification_logs_immutable ON verification_logs;
CREATE TRIGGER verification_logs_immutable
  BEFORE UPDATE OR DELETE ON verification_logs
  FOR EACH ROW EXECUTE FUNCTION forbid_log_changes();

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE recipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE recipe_components ENABLE ROW LEVEL SECURITY;
ALTER TABLE cutting_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE verification_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE verification_logs ENABLE ROW LEVEL SECURITY;