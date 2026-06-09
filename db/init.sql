-- Highfil CRM - PostgreSQL Schema

CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'operator' CHECK(role IN ('operator', 'supervisor')),
  name TEXT NOT NULL,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS clients (
  id SERIAL PRIMARY KEY,
  first_name TEXT,
  middle_name TEXT,
  last_name TEXT,
  nickname TEXT,
  organization TEXT,
  email TEXT,
  phone TEXT,
  phone2 TEXT,
  phone3 TEXT,
  notes TEXT,
  city TEXT,
  region TEXT,
  country TEXT,
  source TEXT,
  normalized_phone TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS calls (
  id SERIAL PRIMARY KEY,
  client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  operator_id INTEGER NOT NULL REFERENCES users(id),
  status TEXT NOT NULL CHECK(status IN (
    'acepto', 'rechazo', 'no_contesta', 'numero_invalido',
    'ya_en_app', 'llamar_despues', 'sin_info', 'pendiente'
  )),
  notes TEXT,
  scheduled_at TIMESTAMPTZ,
  duration_seconds INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS assignments (
  id SERIAL PRIMARY KEY,
  client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  operator_id INTEGER NOT NULL REFERENCES users(id),
  assigned_by INTEGER NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_calls_client ON calls(client_id);
CREATE INDEX IF NOT EXISTS idx_calls_operator ON calls(operator_id);
CREATE INDEX IF NOT EXISTS idx_assignments_operator ON assignments(operator_id);
CREATE INDEX IF NOT EXISTS idx_assignments_client ON assignments(client_id);
CREATE INDEX IF NOT EXISTS idx_clients_phone ON clients(normalized_phone);

-- Seed default users
-- admin/admin123, operador1/operador1
INSERT INTO users (username, password, role, name)
SELECT 'admin', '$2a$10$cdraVDuhHEmIvzM2tV7sG.pXf7nOlm1vM.dVBE1GAv4HwHkAibYu.', 'supervisor', 'Supervisor'
WHERE NOT EXISTS (SELECT 1 FROM users WHERE username = 'admin');

INSERT INTO users (username, password, role, name)
SELECT 'operador1', '$2a$10$sYnX1v3pzF7/6kAPqFa3e.79kzPuzep7Grkcqp9zHUh0mkKAkEJHm', 'operator', 'Operador 1'
WHERE NOT EXISTS (SELECT 1 FROM users WHERE username = 'operador1');
