const express = require('express');
const pool = require('../db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { SECRET } = require('../middleware');

const router = express.Router();

async function login(req, res) {
  const { username, company_id } = req.body;
  const { password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Username and password required' });

  try {
    let query, params;

    if (company_id) {
      query = `
        SELECT u.* FROM users u
        INNER JOIN company_members cm ON cm.user_id = u.id
        WHERE u.username = $1 AND u.active = true AND cm.company_id = $2
        LIMIT 1
      `;
      params = [username, company_id];
    } else {
      query = `
        SELECT u.* FROM users u
        WHERE u.username = $1 AND u.active = true
        LIMIT 1
      `;
      params = [username];
    }

    const { rows } = await pool.query(query, params);
    const user = rows[0];

    if (!user || !bcrypt.compareSync(password, user.password)) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const { rows: companies } = await pool.query(
      'SELECT c.id, c.name, c.slug FROM companies c INNER JOIN company_members cm ON cm.company_id = c.id WHERE cm.user_id = $1 AND c.active = true',
      [user.id]
    );

    const { rows: memberRole } = await pool.query(
      'SELECT role FROM company_members WHERE user_id = $1 AND company_id = $2',
      [user.id, user.primary_company_id]
    );

    const payload = {
      id: user.id,
      username: user.username,
      role: user.role,
      name: user.name,
      company_id: user.primary_company_id,
      companies: companies.map(c => ({ id: c.id, name: c.name, slug: c.slug })),
    };

    const token = jwt.sign(payload, SECRET, { expiresIn: '24h' });

    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        name: user.name,
        primary_company_id: user.primary_company_id,
      },
      companies: payload.companies,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function me(req, res) {
  try {
    const { rows } = await pool.query(
      'SELECT id, username, role, name FROM users WHERE id = $1',
      [req.user.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'User not found' });

    const { rows: companies } = await pool.query(
      'SELECT c.id, c.name, c.slug FROM companies c INNER JOIN company_members cm ON cm.company_id = c.id WHERE cm.user_id = $1 AND c.active = true',
      [req.user.id]
    );

    res.json({ ...rows[0], companies });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function getCompanies(req, res) {
  const { role, id } = req.user;

  try {
    if (role === 'super_admin') {
      const { rows } = await pool.query(
        'SELECT id, name, slug, active FROM companies ORDER BY name'
      );
      return res.json(rows);
    }

    const { rows } = await pool.query(
      `SELECT c.id, c.name, c.slug, c.active, cm.role as member_role
       FROM companies c
       INNER JOIN company_members cm ON cm.company_id = c.id
       WHERE cm.user_id = $1 AND c.active = true
       ORDER BY c.name`,
      [id]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function createCompany(req, res) {
  const { name, slug } = req.body;
  if (!name) return res.status(400).json({ error: 'name required' });

  try {
    const { rows: existing } = await pool.query(
      'SELECT id FROM companies WHERE slug = $1',
      [slug || name.toLowerCase().replace(/\s+/g, '-')]
    );
    if (existing.length > 0) return res.status(400).json({ error: 'Company slug already exists' });

    const { rows } = await pool.query(
      'INSERT INTO companies (name, slug, created_by) VALUES ($1, $2, $3) RETURNING *',
      [name, slug || name.toLowerCase().replace(/\s+/g, '-'), req.user.id]
    );

    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function getCompany(req, res) {
  try {
    const { rows } = await pool.query(
      'SELECT id, name, slug, active, created_at FROM companies WHERE id = $1',
      [req.params.companyId]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Company not found' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function updateCompany(req, res) {
  const { name, active } = req.body;
  try {
    const updates = [];
    const params = [];
    let i = 1;
    if (name) { updates.push(`name = $${i++}`); params.push(name); }
    if (active !== undefined) { updates.push(`active = $${i++}`); params.push(active); }
    if (updates.length === 0) return res.status(400).json({ error: 'Nothing to update' });

    params.push(req.params.companyId);
    const { rows } = await pool.query(
      `UPDATE companies SET ${updates.join(', ')} WHERE id = $${i} RETURNING *`,
      params
    );
    if (!rows[0]) return res.status(404).json({ error: 'Company not found' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function deleteCompany(req, res) {
  const { role } = req.user;
  if (role !== 'super_admin') return res.status(403).json({ error: 'Super admin only' });

  try {
    const { rows } = await pool.query(
      'DELETE FROM companies WHERE id = $1 RETURNING *',
      [req.params.companyId]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Company not found' });
    res.json({ message: 'Company deleted', company: rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function joinCompany(req, res) {
  const { role, id } = req.user;
  if (role !== 'super_admin') return res.status(403).json({ error: 'Super admin only' });

  const companyId = parseInt(req.params.companyId);
  if (!companyId) return res.status(400).json({ error: 'companyId required' });

  try {
    const { rows: existing } = await pool.query(
      'SELECT id FROM company_members WHERE company_id = $1 AND user_id = $2',
      [companyId, id]
    );

    if (existing.length === 0) {
      await pool.query(
        'INSERT INTO company_members (company_id, user_id, role) VALUES ($1, $2, $3)',
        [companyId, id, 'supervisor']
      );
    }

    const { rows: company } = await pool.query(
      'SELECT id, name, slug, active FROM companies WHERE id = $1',
      [companyId]
    );

    res.json({ message: 'Joined company', company: company[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function getUsers(req, res) {
  const { role } = req.user;
  const companyId = req.companyId;

  if (role !== 'super_admin' && role !== 'supervisor') return res.json([]);

  try {
    const { rows } = await pool.query(
      'SELECT u.id, u.username, u.role, u.name, u.active FROM users u WHERE u.primary_company_id = $1',
      [companyId]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

const { auth } = require('../middleware');

router.post('/login', login);
router.get('/me', auth, me);
router.get('/companies', auth, getCompanies);
router.post('/companies', auth, createCompany);
router.get('/companies/:companyId', auth, getCompany);
router.put('/companies/:companyId', auth, updateCompany);
router.delete('/companies/:companyId', auth, deleteCompany);
router.post('/companies/:companyId/join', auth, joinCompany);

module.exports = router;
