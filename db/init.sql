-- Highfil CRM - Multitenant PostgreSQL Schema

-- ============================================================
-- USERS (must be first - other tables reference it)
-- ============================================================
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  username TEXT NOT NULL,
  password TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'operator' CHECK(role IN ('operator', 'supervisor', 'super_admin')),
  name TEXT NOT NULL,
  active BOOLEAN DEFAULT true,
  primary_company_id INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(username, primary_company_id)
);

-- ============================================================
-- COMPANIES (tenants)
-- ============================================================
CREATE TABLE IF NOT EXISTS companies (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT UNIQUE,
  active BOOLEAN DEFAULT true,
  created_by INTEGER REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add FK from users to companies now that companies exists
ALTER TABLE users ADD CONSTRAINT fk_users_company
  FOREIGN KEY (primary_company_id) REFERENCES companies(id) ON DELETE SET NULL;

-- ============================================================
-- CLIENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS clients (
  id SERIAL PRIMARY KEY,
  company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
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

-- ============================================================
-- CALLS
-- ============================================================
CREATE TABLE IF NOT EXISTS calls (
  id SERIAL PRIMARY KEY,
  company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
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

-- ============================================================
-- ASSIGNMENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS assignments (
  id SERIAL PRIMARY KEY,
  company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  operator_id INTEGER NOT NULL REFERENCES users(id),
  assigned_by INTEGER NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- COMPANY MEMBERS (relacion multi-usuario por empresa)
-- ============================================================
CREATE TABLE IF NOT EXISTS company_members (
  id SERIAL PRIMARY KEY,
  company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'operator' CHECK(role IN ('operator', 'supervisor')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, user_id)
);

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_users_company ON users(primary_company_id);
CREATE INDEX IF NOT EXISTS idx_clients_company ON clients(company_id);
CREATE INDEX IF NOT EXISTS idx_clients_phone ON clients(normalized_phone);
CREATE INDEX IF NOT EXISTS idx_clients_company_phone ON clients(company_id, normalized_phone);
CREATE INDEX IF NOT EXISTS idx_calls_company ON calls(company_id);
CREATE INDEX IF NOT EXISTS idx_calls_client ON calls(client_id);
CREATE INDEX IF NOT EXISTS idx_calls_operator ON calls(operator_id);
CREATE INDEX IF NOT EXISTS idx_assignments_company ON assignments(company_id);
CREATE INDEX IF NOT EXISTS idx_assignments_operator ON assignments(operator_id);
CREATE INDEX IF NOT EXISTS idx_assignments_client ON assignments(client_id);
CREATE INDEX IF NOT EXISTS idx_company_members_user ON company_members(user_id);
CREATE INDEX IF NOT EXISTS idx_company_members_company ON company_members(company_id);

-- ============================================================
-- SEED DATA: Super Admin (only user by default)
-- ============================================================
-- Super Admin: superadmin / superadmin123
INSERT INTO users (username, password, role, name, active, primary_company_id)
SELECT 'superadmin', '$2a$10$4R91V8UCDcsMfz7NrZPyiu5bpbg2/xHVxlg.CGoMTtJP4RNA3SJ4a', 'super_admin', 'Super Administrador', true, NULL
WHERE NOT EXISTS (SELECT 1 FROM users WHERE username = 'superadmin');