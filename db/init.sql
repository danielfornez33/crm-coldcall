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
-- SEED DATA: Initial Setup
-- ============================================================
-- Super Admin: superadmin / superadmin123
INSERT INTO users (username, password, role, name, active, primary_company_id)
SELECT 'superadmin', '$2a$10$il9cd91OhKPfwuevnVuxNue1JDoacHraGYWpiZzjG0l.05WOgD3AG', 'super_admin', 'Super Administrador', true, NULL
WHERE NOT EXISTS (SELECT 1 FROM users WHERE username = 'superadmin');

-- Demo Company
INSERT INTO companies (name, slug, active, created_by)
SELECT 'Empresa Demo', 'empresa-demo', true, 1
WHERE NOT EXISTS (SELECT 1 FROM companies WHERE slug = 'empresa-demo');

-- Demo Supervisor: supervisor / superadmin123
INSERT INTO users (username, password, role, name, active, primary_company_id)
SELECT 'supervisor', '$2a$10$il9cd91OhKPfwuevnVuxNue1JDoacHraGYWpiZzjG0l.05WOgD3AG', 'supervisor', 'Supervisor Demo', true, 1
WHERE NOT EXISTS (SELECT 1 FROM users WHERE username = 'supervisor' AND primary_company_id = 1);

-- Demo Operator: operator / superadmin123
INSERT INTO users (username, password, role, name, active, primary_company_id)
SELECT 'operator', '$2a$10$il9cd91OhKPfwuevnVuxNue1JDoacHraGYWpiZzjG0l.05WOgD3AG', 'operator', 'Operador Demo', true, 1
WHERE NOT EXISTS (SELECT 1 FROM users WHERE username = 'operator' AND primary_company_id = 1);

-- Add users to company
INSERT INTO company_members (company_id, user_id, role)
SELECT 1, 2, 'supervisor'
WHERE NOT EXISTS (SELECT 1 FROM company_members WHERE company_id = 1 AND user_id = 2);

INSERT INTO company_members (company_id, user_id, role)
SELECT 1, 3, 'operator'
WHERE NOT EXISTS (SELECT 1 FROM company_members WHERE company_id = 1 AND user_id = 3);

-- Demo Clients for testing
INSERT INTO clients (company_id, first_name, last_name, organization, phone, normalized_phone, email, city, source)
SELECT 1, 'Juan', 'García', 'Empresa XYZ', '+1234567890', '1234567890', 'juan@xyz.com', 'Madrid', 'demo'
WHERE NOT EXISTS (SELECT 1 FROM clients WHERE normalized_phone = '1234567890' AND company_id = 1);

INSERT INTO clients (company_id, first_name, last_name, organization, phone, normalized_phone, email, city, source)
SELECT 1, 'María', 'López', 'Tech Solutions', '+0987654321', '0987654321', 'maria@tech.com', 'Barcelona', 'demo'
WHERE NOT EXISTS (SELECT 1 FROM clients WHERE normalized_phone = '0987654321' AND company_id = 1);

INSERT INTO clients (company_id, first_name, last_name, organization, phone, normalized_phone, email, city, source)
SELECT 1, 'Carlos', 'Martínez', 'Construcciones SA', '+1122334455', '1122334455', 'carlos@const.com', 'Valencia', 'demo'
WHERE NOT EXISTS (SELECT 1 FROM clients WHERE normalized_phone = '1122334455' AND company_id = 1);

INSERT INTO clients (company_id, first_name, last_name, organization, phone, normalized_phone, email, city, source)
SELECT 1, 'Laura', 'Fernández', 'Marketing Digital', '+5566778899', '5566778899', 'laura@mkt.com', 'Sevilla', 'demo'
WHERE NOT EXISTS (SELECT 1 FROM clients WHERE normalized_phone = '5566778899' AND company_id = 1);

-- Assign clients to operator
INSERT INTO assignments (company_id, client_id, operator_id, assigned_by)
SELECT 1, c.id, 3, 2
FROM clients c
WHERE c.company_id = 1 AND NOT EXISTS (
  SELECT 1 FROM assignments WHERE client_id = c.id AND operator_id = 3 AND company_id = 1
);

-- Add sample calls
INSERT INTO calls (company_id, client_id, operator_id, status, notes)
SELECT 1, 
  (SELECT id FROM clients WHERE company_id = 1 AND normalized_phone = '1234567890' LIMIT 1),
  3,
  'acepto',
  'Cliente interesado en el producto'
WHERE NOT EXISTS (
  SELECT 1 FROM calls WHERE company_id = 1 AND client_id = (SELECT id FROM clients WHERE normalized_phone = '1234567890')
);

INSERT INTO calls (company_id, client_id, operator_id, status, notes)
SELECT 1,
  (SELECT id FROM clients WHERE company_id = 1 AND normalized_phone = '0987654321' LIMIT 1),
  3,
  'no_contesta',
  'Sin respuesta, reintentar mañana'
WHERE NOT EXISTS (
  SELECT 1 FROM calls WHERE company_id = 1 AND client_id = (SELECT id FROM clients WHERE normalized_phone = '0987654321')
);