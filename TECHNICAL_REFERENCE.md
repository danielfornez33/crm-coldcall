# Multitenant Implementation - Technical Reference

## Table of Contents
1. [Detailed Query Examples](#detailed-query-examples)
2. [Database Migration SQL](#database-migration-sql)
3. [Backend Code Changes](#backend-code-changes)
4. [Frontend Code Changes](#frontend-code-changes)
5. [Testing Strategy](#testing-strategy)

---

## Detailed Query Examples

### Current Single-Tenant Queries vs Multitenant

#### Example 1: List Clients

**BEFORE (Single-Tenant):**
```sql
-- Supervisor sees all clients
SELECT * FROM clients 
ORDER BY last_name ASC 
LIMIT 200;

-- Operator sees assigned clients
SELECT c.* FROM clients c
INNER JOIN assignments a ON a.client_id = c.id
WHERE a.operator_id = 5
ORDER BY c.last_name ASC 
LIMIT 200;
```

**AFTER (Multitenant):**
```sql
-- Supervisor sees all clients in their company
SELECT * FROM clients 
WHERE company_id = 1
ORDER BY last_name ASC 
LIMIT 200;

-- Operator sees assigned clients in their company
SELECT c.* FROM clients c
INNER JOIN assignments a ON a.client_id = c.id
WHERE a.operator_id = 5 
  AND c.company_id = 1
  AND a.company_id = 1
ORDER BY c.last_name ASC 
LIMIT 200;
```

#### Example 2: Create Call

**BEFORE:**
```sql
INSERT INTO calls (client_id, operator_id, status, notes, created_at)
VALUES ($1, $2, $3, $4, NOW());
```

**AFTER:**
```sql
INSERT INTO calls (client_id, operator_id, status, notes, company_id, created_at)
VALUES ($1, $2, $3, $4, $5, NOW());
```

Also need validation:
```javascript
// Verify client and operator belong to same company
const client = await pool.query(
  'SELECT company_id FROM clients WHERE id = $1', 
  [clientId]
);
if (client.rows[0].company_id !== req.user.company_id) {
  return res.status(403).json({ error: 'Unauthorized' });
}
```

#### Example 3: Get Dashboard Stats

**BEFORE:**
```sql
-- All stats for system
SELECT COUNT(*)::int AS count FROM clients;
SELECT COUNT(*)::int AS count FROM calls;
SELECT DISTINCT client_id FROM calls;
```

**AFTER:**
```sql
-- Stats scoped to company
SELECT COUNT(*)::int AS count FROM clients 
WHERE company_id = $1;

SELECT COUNT(*)::int AS count FROM calls 
WHERE company_id = $1;

SELECT DISTINCT client_id FROM calls 
WHERE company_id = $1;
```

#### Example 4: Bulk Assignment

**BEFORE:**
```sql
SELECT client_id, operator_id FROM assignments 
WHERE operator_id = $1 AND client_id = ANY($2);
```

**AFTER:**
```sql
SELECT client_id, operator_id FROM assignments 
WHERE operator_id = $1 
  AND company_id = $2
  AND client_id = ANY($3);
```

---

## Database Migration SQL

### Step 1: Add New Companies Table

```sql
-- Create companies table
CREATE TABLE IF NOT EXISTS companies (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  domain TEXT,
  billing_plan TEXT DEFAULT 'free',
  subscription_status TEXT DEFAULT 'active',
  max_operators INTEGER,
  max_clients INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_companies_slug ON companies(slug);
CREATE INDEX idx_companies_domain ON companies(domain);
```

### Step 2: Add company_id to Existing Tables

```sql
-- Add company_id to users
ALTER TABLE users 
ADD COLUMN company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE;

-- Add company_id to clients
ALTER TABLE clients 
ADD COLUMN company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE;

-- Add company_id to calls
ALTER TABLE calls 
ADD COLUMN company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE;

-- Add company_id to assignments
ALTER TABLE assignments 
ADD COLUMN company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE;
```

### Step 3: Create Indexes

```sql
-- Username should be unique per company
ALTER TABLE users 
DROP CONSTRAINT users_username_key;

CREATE UNIQUE INDEX idx_users_username_company 
ON users(username, company_id);

-- Client phone deduplication per company
CREATE UNIQUE INDEX idx_clients_phone_company 
ON clients(company_id, normalized_phone) 
WHERE normalized_phone IS NOT NULL;

-- Performance indexes for queries
CREATE INDEX idx_calls_company_operator 
ON calls(company_id, operator_id);

CREATE INDEX idx_calls_company_client 
ON calls(company_id, client_id);

CREATE INDEX idx_assignments_company_operator 
ON assignments(company_id, operator_id);

CREATE INDEX idx_assignments_company_client 
ON assignments(company_id, client_id);
```

### Step 4: Migrate Existing Data

```sql
-- Create default company for existing data
INSERT INTO companies (name, slug, billing_plan, subscription_status)
VALUES ('Default Company', 'default-company', 'free', 'active')
RETURNING id;

-- Assume default company gets ID = 1
-- Update all existing data to belong to company 1
UPDATE users SET company_id = 1 WHERE company_id IS NULL;
UPDATE clients SET company_id = 1 WHERE company_id IS NULL;
UPDATE calls SET company_id = 1 WHERE company_id IS NULL;
UPDATE assignments SET company_id = 1 WHERE company_id IS NULL;

-- Add NOT NULL constraint after migration
ALTER TABLE users ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE clients ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE calls ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE assignments ALTER COLUMN company_id SET NOT NULL;
```

### Step 5: Optional - Row Level Security (RLS)

```sql
-- Enable RLS on all tables
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE calls ENABLE ROW LEVEL SECURITY;
ALTER TABLE assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY company_clients ON clients
USING (company_id = current_setting('app.company_id')::int)
WITH CHECK (company_id = current_setting('app.company_id')::int);

CREATE POLICY company_calls ON calls
USING (company_id = current_setting('app.company_id')::int)
WITH CHECK (company_id = current_setting('app.company_id')::int);

CREATE POLICY company_assignments ON assignments
USING (company_id = current_setting('app.company_id')::int)
WITH CHECK (company_id = current_setting('app.company_id')::int);

CREATE POLICY company_users ON users
USING (company_id = current_setting('app.company_id')::int)
WITH CHECK (company_id = current_setting('app.company_id')::int);

-- When using RLS, set the company_id in every query:
-- await pool.query("SET app.company_id = $1", [req.user.company_id]);
```

---

## Backend Code Changes

### 1. Update Middleware (`middleware.js`)

```javascript
const jwt = require('jsonwebtoken');

const SECRET = process.env.JWT_SECRET || 'highfil-crm-secret-2026';

// Existing auth middleware
function auth(req, res, next) {
  const header = req.headers.authorization;
  if (!header) return res.status(401).json({ error: 'No token provided' });
  const token = header.split(' ')[1];
  try {
    const decoded = jwt.verify(token, SECRET);
    req.user = decoded;
    // NOW INCLUDES company_id from JWT
    req.company_id = decoded.company_id;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

// NEW: Tenant validation middleware
function tenantCheck(req, res, next) {
  const urlCompanyId = parseInt(req.params.company_id);
  if (urlCompanyId !== req.user.company_id) {
    return res.status(403).json({ error: 'Unauthorized' });
  }
  next();
}

// Existing supervisor check
function supervisorOnly(req, res, next) {
  if (req.user.role !== 'supervisor') {
    return res.status(403).json({ error: 'Supervisor only' });
  }
  next();
}

// NEW: Check if user belongs to company
async function belongsToCompany(pool) {
  return async (req, res, next) => {
    try {
      const { rows } = await pool.query(
        'SELECT id FROM users WHERE id = $1 AND company_id = $2',
        [req.user.id, req.user.company_id]
      );
      if (rows.length === 0) {
        return res.status(403).json({ error: 'User not in company' });
      }
      next();
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  };
}

module.exports = { auth, supervisorOnly, tenantCheck, belongsToCompany, SECRET };
```

### 2. Update Auth Routes (`routes/auth.js`)

```javascript
const express = require('express');
const pool = require('../db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { SECRET } = require('../middleware');

const router = express.Router();

async function login(req, res) {
  const { username, password, company_slug } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password required' });
  }

  try {
    // Look up company by slug (or could use subdomain)
    let company_id = req.body.company_id; // From subdomain middleware
    if (company_slug && !company_id) {
      const { rows: companies } = await pool.query(
        'SELECT id FROM companies WHERE slug = $1 LIMIT 1',
        [company_slug]
      );
      if (companies.length === 0) {
        return res.status(404).json({ error: 'Company not found' });
      }
      company_id = companies[0].id;
    }

    if (!company_id) {
      return res.status(400).json({ error: 'Company not specified' });
    }

    // Query user in specific company
    const { rows } = await pool.query(
      'SELECT * FROM users WHERE username = $1 AND company_id = $2 AND active = true LIMIT 1',
      [username, company_id]
    );

    const user = rows[0];
    if (!user || !bcrypt.compareSync(password, user.password)) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Include company_id in JWT
    const token = jwt.sign(
      {
        id: user.id,
        username: user.username,
        role: user.role,
        name: user.name,
        company_id: user.company_id  // NEW
      },
      SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        name: user.name,
        company_id: user.company_id  // NEW
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function me(req, res) {
  try {
    const { rows } = await pool.query(
      'SELECT id, username, role, name, company_id FROM users WHERE id = $1 AND company_id = $2',
      [req.user.id, req.user.company_id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'User not found' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function getUsers(req, res) {
  if (req.user.role !== 'supervisor') return res.json([]);
  try {
    // Only return users in current company
    const { rows } = await pool.query(
      'SELECT id, username, role, name, active FROM users WHERE company_id = $1',
      [req.user.company_id]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

const { auth } = require('../middleware');

router.post('/login', login);
router.get('/me', auth, me);
router.get('/users', auth, getUsers);

module.exports = router;
```

### 3. Update Clients Routes (`routes/clients.js`)

```javascript
const express = require('express');
const pool = require('../db');
const { auth } = require('../middleware');

const router = express.Router();
router.use(auth);

async function listClients(req, res) {
  const { assigned, search } = req.query;

  try {
    let query, params;

    if (assigned === 'mine' && req.user.role === 'operator') {
      query = `
        SELECT c.* FROM clients c
        INNER JOIN assignments a ON a.client_id = c.id
        WHERE a.operator_id = $1 
          AND c.company_id = $2
          AND a.company_id = $2
        ORDER BY c.last_name ASC NULLS LAST
        LIMIT 200
      `;
      params = [req.user.id, req.user.company_id];
    } else if (search) {
      const s = `%${search}%`;
      query = `
        SELECT * FROM clients
        WHERE company_id = $1
          AND (first_name ILIKE $2 OR last_name ILIKE $2 
               OR nickname ILIKE $2 OR organization ILIKE $2 
               OR phone ILIKE $2 OR normalized_phone ILIKE $2)
        ORDER BY last_name ASC NULLS LAST
        LIMIT 200
      `;
      params = [req.user.company_id, s];
    } else {
      query = `
        SELECT * FROM clients 
        WHERE company_id = $1
        ORDER BY last_name ASC NULLS LAST 
        LIMIT 200
      `;
      params = [req.user.company_id];
    }

    const { rows } = await pool.query(query, params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function getClient(req, res) {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM clients WHERE id = $1 AND company_id = $2',
      [req.params.id, req.user.company_id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Client not found' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

router.get('/', listClients);
router.get('/:id', getClient);

module.exports = router;
```

### 4. Update Calls Routes (pattern)

```javascript
async function createCall(req, res) {
  const { client_id, status, notes, scheduled_at, duration_seconds } = req.body;
  if (!client_id || !status) {
    return res.status(400).json({ error: 'client_id and status required' });
  }

  try {
    // Verify client belongs to user's company
    const { rows: clientRows } = await pool.query(
      'SELECT company_id FROM clients WHERE id = $1',
      [client_id]
    );

    if (clientRows.length === 0) {
      return res.status(404).json({ error: 'Client not found' });
    }

    if (clientRows[0].company_id !== req.user.company_id) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    // Create call with company_id
    const { rows } = await pool.query(`
      INSERT INTO calls (client_id, operator_id, status, notes, 
                        scheduled_at, duration_seconds, company_id)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `, [
      parseInt(client_id),
      req.user.id,
      status,
      notes || null,
      scheduled_at || null,
      duration_seconds || null,
      req.user.company_id
    ]);

    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
```

---

## Frontend Code Changes

### 1. Update AuthContext

```typescript
import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import api from '../api';

interface User {
  id: number;
  username: string;
  role: string;
  name: string;
  company_id: number;  // NEW
}

interface AuthCtx {
  user: User | null;
  token: string | null;
  company_id: number | null;  // NEW
  login: (username: string, password: string, company_slug?: string) => Promise<void>;
  logout: () => void;
  loading: boolean;
}

const AuthContext = createContext<AuthCtx>(null!);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem('token'));
  const [company_id, setCompanyId] = useState<number | null>(
    parseInt(localStorage.getItem('company_id') || '') || null
  );
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (token) {
      api.get('/auth/me').then(r => {
        setUser(r.data);
        setCompanyId(r.data.company_id);
        localStorage.setItem('user', JSON.stringify(r.data));
        localStorage.setItem('company_id', r.data.company_id.toString());
      }).catch(() => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        localStorage.removeItem('company_id');
        setToken(null);
        setCompanyId(null);
      }).finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [token]);

  const login = async (username: string, password: string, company_slug?: string) => {
    const payload: any = { username, password };
    if (company_slug) {
      payload.company_slug = company_slug;
    }

    const r = await api.post('/auth/login', payload);
    localStorage.setItem('token', r.data.token);
    localStorage.setItem('user', JSON.stringify(r.data.user));
    localStorage.setItem('company_id', r.data.user.company_id.toString());
    setToken(r.data.token);
    setUser(r.data.user);
    setCompanyId(r.data.user.company_id);
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('company_id');
    setToken(null);
    setUser(null);
    setCompanyId(null);
  };

  return (
    <AuthContext.Provider value={{ user, token, company_id, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
```

### 2. Update API Client

```typescript
import axios from 'axios';
import { useAuth } from './context/AuthContext';

const api = axios.create({ baseURL: '/api' });

api.interceptors.request.use(config => {
  const token = localStorage.getItem('token');
  const company_id = localStorage.getItem('company_id');
  
  if (token) config.headers.Authorization = `Bearer ${token}`;
  
  // Dynamic base URL based on company
  if (company_id) {
    // This assumes you're using path-based routing
    // Otherwise adjust as needed for subdomain routing
    config.baseURL = `/api/companies/${company_id}`;
  }
  
  return config;
});

api.interceptors.response.use(
  res => res,
  err => {
    if (err.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      localStorage.removeItem('company_id');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

export default api;
```

### 3. Update Login Page

```typescript
// frontend/src/pages/Login.tsx
import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [companySlug, setCompanySlug] = useState('');  // NEW
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await login(username, password, companySlug);
      navigate('/');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <h1>Highfil CRM</h1>
      <form onSubmit={handleLogin}>
        <input
          type="text"
          placeholder="Empresa (slug)"
          value={companySlug}
          onChange={e => setCompanySlug(e.target.value)}
          required
        />
        <input
          type="text"
          placeholder="Usuario"
          value={username}
          onChange={e => setUsername(e.target.value)}
          required
        />
        <input
          type="password"
          placeholder="Contraseña"
          value={password}
          onChange={e => setPassword(e.target.value)}
          required
        />
        <button type="submit" disabled={loading}>
          {loading ? 'Ingresando...' : 'Ingresar'}
        </button>
      </form>
      {error && <div className="error">{error}</div>}
    </div>
  );
}
```

---

## Testing Strategy

### Unit Tests

```javascript
// Test isolating company data
describe('Company Isolation', () => {
  test('Operator A cannot see Operator B data from different company', async () => {
    // Create company 1 and 2
    // Create operator in each
    // Operator 1 should NOT see calls from Operator 2
  });

  test('Supervisor A cannot see Company B data', async () => {
    // Create two companies with supervisors
    // Supervisor 1 should NOT see Company 2 clients/calls
  });

  test('Query includes company_id filter', async () => {
    // Verify every SELECT query includes company_id in WHERE
  });
});
```

### Integration Tests

```javascript
describe('Multitenant Integration', () => {
  test('User can only login to their company', async () => {
    // Try login with Company B username to Company A subdomain
    // Should fail
  });

  test('Client assignment respects company boundaries', async () => {
    // Try assigning Company B client to Company A operator
    // Should fail
  });

  test('Call creation validates client company', async () => {
    // Operator from Company A tries to create call for Client in Company B
    // Should fail
  });
});
```

### Security Tests

```javascript
describe('Security Tests', () => {
  test('No data leakage in dashboard', async () => {
    // Fetch dashboard from Supervisor A
    // Verify only Company A stats are returned
  });

  test('No username conflict between companies', async () => {
    // Create user "john" in Company A
    // Create user "john" in Company B
    // Both should be allowed, login should distinguish
  });

  test('RLS policies enforced', async () => {
    // If using PostgreSQL RLS
    // Directly query database bypassing app layer
    // Should still enforce company isolation
  });
});
```

---

## Migration Checklist

- [ ] Database schema migrations tested in staging
- [ ] All queries audited for company_id filters
- [ ] JWT payload updated to include company_id
- [ ] Auth middleware verified
- [ ] Frontend routes updated with company_id
- [ ] API client baseURL dynamic
- [ ] Login flow supports company context
- [ ] Test cases for isolation written and passing
- [ ] Performance tested with indexes
- [ ] Backup strategy defined
- [ ] Rollback plan documented
- [ ] Production deployment scheduled

---

**Last Updated**: June 9, 2026
