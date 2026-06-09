# HIGHFIL CRM - Multitenant Architecture Analysis - Executive Summary

## Quick Overview

**Current Status**: Single-tenant CRM application
**Target**: Multi-company support with isolated data per tenant
**Complexity**: Medium | **Effort**: 80-120 hours | **Risk Level**: Medium-High

---

## 1. Current Data Model at a Glance

```
┌─────────────────────────────────────────────────────────────────┐
│                    DATABASE STRUCTURE                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  USERS                     CLIENTS                               │
│  ├─ id (pk)               ├─ id (pk)                             │
│  ├─ username (unique)     ├─ first_name                          │
│  ├─ password              ├─ last_name                           │
│  ├─ role (operator|super) ├─ phone                               │
│  ├─ name                  ├─ organization                        │
│  └─ active                ├─ email                               │
│                           ├─ normalized_phone (dedup)            │
│                           └─ source (csv/vcf)                    │
│         ↓ creates         │         ↑ related to                │
│         │                 │         │                            │
│  CALLS                    ASSIGNMENTS                            │
│  ├─ id (pk)              ├─ id (pk)                              │
│  ├─ client_id (fk)       ├─ client_id (fk)                       │
│  ├─ operator_id (fk) ─────┼─ operator_id (fk)                    │
│  ├─ status (enum)        ├─ assigned_by (fk → users)            │
│  ├─ notes                └─ created_at                           │
│  └─ created_at                                                   │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

**4 Core Tables**: Users | Clients | Calls | Assignments

---

## 2. Features by Role

### OPERATOR (Call Agent)
- ✅ View assigned clients only
- ✅ Search within assigned clients
- ✅ Record call outcomes (8 status types)
- ✅ View personal call history
- ✅ Personal statistics dashboard
- ❌ Cannot see other operators' data
- ❌ Cannot create users
- ❌ Cannot import clients

### SUPERVISOR (Manager/Admin)
- ✅ View all clients, calls, operators
- ✅ Create/edit/deactivate operators
- ✅ Bulk assign clients to operators
- ✅ Import clients (CSV/VCF)
- ✅ Global dashboard with metrics
- ✅ Export all data
- ✅ Operator progress tracking
- ❌ Cannot deactivate themselves
- ⚠️ Can see ALL data (security concern for multitenant)

### Call Status Options
`acepto` | `rechazo` | `no_contesta` | `numero_invalido` | `ya_en_app` | `llamar_despues` | `sin_info` | `pendiente`

---

## 3. Current Data Isolation Analysis

| Aspect | Status | Details |
|--------|--------|---------|
| **Operator Isolation** | ✅ Strong | Operators only see their assigned clients and own calls |
| **Supervisor Isolation** | ❌ None | Supervisors see ALL data (intentional for single tenant) |
| **Cross-Tenant Data** | ❌ NO | No company_id field exists - no multitenant support |
| **Username Uniqueness** | Global | Would conflict if same company names in multitenant |
| **Data Leakage Risk** | ⚠️ High | If bug in supervisor code, affects all data |

---

## 4. Authentication & Authorization

### Current Flow

```
LOGIN REQUEST
    ↓
[POST /auth/login {username, password}]
    ↓
[Query: users WHERE username = $1]
    ↓
[bcrypt password validation]
    ↓
[Generate JWT: {id, username, role, name}]
    ↓
[Store token in localStorage]
    ↓
[All future requests: Authorization: Bearer <token>]
    ↓
[Middleware verifies JWT and extracts req.user]
    ↓
[Role-based filtering on queries]
```

### Current Implementation
- **Authentication**: JWT (24h expiration)
- **Password Security**: bcryptjs (10 rounds)
- **Session**: Stateless (no server-side sessions)
- **Role Check**: Simple role column (operator|supervisor)
- **Data Filtering**: Query-level WHERE clauses based on role

### Security Issues
- ⚠️ Token stored in localStorage (XSS vulnerability)
- ⚠️ No rate limiting on login
- ⚠️ No password complexity requirements
- ⚠️ No refresh token mechanism
- ⚠️ No audit logging

---

## 5. Changes Required for Multitenant

### 5.1 Database Schema Changes

**Add new table: `companies`**
```sql
CREATE TABLE companies (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT UNIQUE,
  billing_plan TEXT,
  subscription_status TEXT,
  max_operators INTEGER,
  max_clients INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Modify all existing tables:**
```
users       → Add: company_id (make username unique per company)
clients     → Add: company_id 
calls       → Add: company_id (for query efficiency)
assignments → Add: company_id
```

**Impact**: ~10 hours of migration work

### 5.2 Backend Changes

**Login flow must know company context:**
- Option A: Subdomain routing (api.company1.com)
- Option B: Company slug in login request
- Option C: Company selection after login

**Every query needs company_id filter:**
- Current: `SELECT * FROM clients WHERE id = $1`
- After: `SELECT * FROM clients WHERE id = $1 AND company_id = $2`

**New endpoints for company management:**
- POST /api/companies (create)
- PUT /api/companies/:id (update)
- GET /api/companies/:id/usage (billing)

**Impact**: ~50 hours (affects 40+ database queries)

### 5.3 Frontend Changes

**Routing restructure:**
- Current: `/operator`, `/supervisor`
- After: `/companies/:company_id/operator`, `/companies/:company_id/supervisor`

**Context updates:**
- AuthContext must include company_id
- New CompanyContext for switching tenants

**API client:**
- Dynamic baseURL: `/api/companies/{company_id}`

**Impact**: ~25 hours

### 5.4 Testing & Deployment

**Critical tests needed:**
- ✅ Operator A cannot see Operator B's data (different company)
- ✅ Supervisor A cannot see Company B data
- ✅ All calls/clients/assignments are company-scoped
- ✅ Data migration doesn't corrupt existing data

**Impact**: ~20 hours

---

## 6. Implementation Roadmap

### Phase 1: Database (2-3 days)
1. Add companies table
2. Add company_id columns to users, clients, calls, assignments
3. Create migration script for existing data
4. Update indexes and constraints

### Phase 2: Backend (5-7 days)
1. Update JWT token to include company_id
2. Modify login to support company context
3. Add tenantCheck middleware
4. Update all 40+ queries with company_id filter
5. Add company management endpoints
6. Implement RLS (optional but recommended)

### Phase 3: Frontend (3-4 days)
1. Update AuthContext for company_id
2. Create CompanyContext
3. Update routing with company parameter
4. Update ProtectedRoute component
5. Update all pages for company context
6. Add company switcher UI

### Phase 4: Testing & QA (2-3 days)
1. Isolation testing
2. Integration testing
3. Load testing with multiple tenants
4. User acceptance testing

### Phase 5: Deployment (1-2 days)
1. Database migration in production
2. Backend deployment
3. Frontend deployment
4. Monitoring and validation

---

## 7. Risk Assessment

### High Priority Risks

🔴 **Data Leakage Between Tenants**
- Risk: Bug in supervisor code could expose all companies' data
- Mitigation: Implement RLS for hard enforcement, comprehensive testing

🔴 **SQL Injection**
- Risk: Unparameterized queries could be exploited to access other company's data
- Mitigation: Audit all queries, use parameterized queries

🔴 **Username Conflicts**
- Risk: Same username in different companies would create confusion
- Mitigation: Change UNIQUE constraint to (username, company_id)

### Medium Priority Risks

🟠 **Token Forgery**
- Risk: Same JWT secret for all tenants
- Mitigation: Already using environment variable (good)

🟠 **Migration Failure**
- Risk: Data corruption during migration
- Mitigation: Test in staging, create rollback plan, backup before migration

🟠 **Query Performance**
- Risk: Slow queries with company_id filters on large tables
- Mitigation: Proper indexing strategy, monitoring

---

## 8. Code Impact Summary

| Component | Files | Lines | Changes Needed |
|-----------|-------|-------|-----------------|
| Database | 1 (init.sql) | 69 | Add 5 new columns, 1 new table |
| Backend Routes | 5 | 500+ | Update 40+ queries with company_id |
| Middleware | 1 | 25 | Add tenantCheck middleware |
| Frontend Routes | 1 | 38 | Add company_id to all routes |
| Context | 1 | 58 | Update AuthContext, add CompanyContext |
| Pages | 5 | 800+ | Update API calls, add company_id |

**Total estimated changes**: 200-300 lines added/modified across entire codebase

---

## 9. Current Strengths for Migration

✅ **Clean role-based architecture** - Already have supervisor/operator separation
✅ **Simple data model** - Only 4 tables to modify
✅ **Query filtering pattern** - Already doing role-based WHERE filtering
✅ **Stateless auth** - JWT makes multi-instance easier
✅ **Good code organization** - Routes separated by resource type
✅ **No complex sharing logic** - Data is mostly 1:1 or 1:many

---

## 10. Timeline & Effort Estimates

```
PHASE 1: Database Setup
├─ Add schema changes ...................... 3 hours
├─ Data migration script ................... 4 hours
├─ Testing & validation ................... 3 hours
└─ Total ............................... 10 hours

PHASE 2: Backend Migration
├─ Update authentication .................. 6 hours
├─ Update 40+ queries .................... 40 hours
├─ New endpoints ......................... 5 hours
├─ Middleware & utilities ................ 5 hours
├─ Testing backend ....................... 8 hours
└─ Total ............................... 64 hours

PHASE 3: Frontend Updates
├─ Update routing & context .............. 8 hours
├─ Update components ..................... 12 hours
├─ API client integration ................ 4 hours
├─ Testing frontend ...................... 6 hours
└─ Total ............................... 30 hours

PHASE 4: Integration & QA
├─ End-to-end testing ................... 10 hours
├─ Security audit ....................... 5 hours
├─ Performance testing ................... 5 hours
└─ Total ............................... 20 hours

PHASE 5: Deployment
├─ Deployment scripts .................... 3 hours
├─ Production migration .................. 3 hours
├─ Monitoring setup ...................... 2 hours
├─ Documentation ......................... 2 hours
└─ Total ............................ 10 hours

TOTAL ESTIMATED EFFORT ............. 134 hours
With contingency (25%) ............ 167 hours
With team: 2-3 weeks (full-time) or 4-6 weeks (part-time)
```

---

## 11. Key Decision Points

### 1. Domain/URL Strategy
- [ ] Subdomain routing? (api.company1.com vs shared api.example.com)
- [ ] Path-based routing? (/api/companies/:id/...)
- [ ] Both?

### 2. Database Strategy
- [ ] Option 1: Shared schema with company_id (simplest, recommended)
- [ ] Option 2: Separate schemas per tenant
- [ ] Option 3: Separate databases per tenant

### 3. Row-Level Security
- [ ] Implement PostgreSQL RLS for hard enforcement? (adds complexity)
- [ ] Rely on application-level filtering? (simpler, riskier)
- [ ] Both for defense-in-depth?

### 4. Billing/Metering
- [ ] Track usage per company from day 1?
- [ ] Add later?
- [ ] What limits to enforce? (operators, clients, calls)

### 5. User Multi-Company Access
- [ ] Allow users in multiple companies? (future feature)
- [ ] Require company selection on login?
- [ ] Support company switching in UI?

---

## 12. Success Criteria

- ✅ Each company's data is completely isolated
- ✅ No data leakage between companies in any scenario
- ✅ Operators from Company A cannot see Company B's clients
- ✅ Supervisors from Company A cannot see Company B's data
- ✅ All queries run efficiently with company_id filters
- ✅ Username can be reused across different companies
- ✅ Login includes company context
- ✅ Zero data loss during migration
- ✅ All tests pass
- ✅ No performance degradation

---

## 13. Next Steps

1. **Review**: Review this analysis with team/stakeholders
2. **Decisions**: Make key decisions (domain strategy, database approach)
3. **Planning**: Create detailed implementation plan
4. **Setup**: Create development/staging environment
5. **Start Phase 1**: Begin database migrations
6. **Iterate**: Follow phased approach

---

## 14. References

Full analysis available in: `/MULTITENANT_ANALYSIS.txt`

Key files to understand:
- `/db/init.sql` - Current database schema
- `/backend/routes/` - All API endpoints
- `/backend/middleware.js` - Auth middleware
- `/frontend/src/context/AuthContext.tsx` - Current auth flow
- `/frontend/src/api.ts` - API client configuration

---

**Document Generated**: June 9, 2026  
**Analysis Type**: Architecture Feasibility Study  
**Status**: READY FOR IMPLEMENTATION  
