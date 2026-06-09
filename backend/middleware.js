const jwt = require('jsonwebtoken');
const pool = require('./db');

const SECRET = process.env.JWT_SECRET || 'highfil-crm-secret-2026';

async function auth(req, res, next) {
  const header = req.headers.authorization;
  if (!header) return res.status(401).json({ error: 'No token provided' });
  const token = header.split(' ')[1];
  try {
    const decoded = jwt.verify(token, SECRET);
    req.user = decoded;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

function extractCompanyId(req) {
  const match = (req.originalUrl || req.url).match(/^\/api\/companies\/(\d+)/);
  return match ? parseInt(match[1]) : null;
}

async function tenantCheck(req, res, next) {
  const companyId = extractCompanyId(req);
  if (!companyId) return res.status(400).json({ error: 'companyId required' });

  const { role, id } = req.user;

  if (role === 'super_admin') {
    req.companyId = companyId;
    return next();
  }

  try {
    const { rows } = await pool.query(
      'SELECT role FROM company_members WHERE company_id = $1 AND user_id = $2',
      [companyId, id]
    );

    if (rows.length === 0) {
      return res.status(403).json({ error: 'Access denied to this company' });
    }

    req.companyRole = rows[0].role;
    req.companyId = companyId;
    next();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

function supervisorOnly(req, res, next) {
  const { role } = req.user;

  if (role === 'super_admin') return next();

  if (req.companyRole !== 'supervisor') {
    return res.status(403).json({ error: 'Supervisor only' });
  }
  next();
}

function superAdminOnly(req, res, next) {
  if (req.user.role !== 'super_admin') {
    return res.status(403).json({ error: 'Super admin only' });
  }
  next();
}

module.exports = { auth, tenantCheck, supervisorOnly, superAdminOnly, SECRET };
