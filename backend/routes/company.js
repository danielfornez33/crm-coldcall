const express = require('express');
const pool = require('../db');
const { auth, tenantCheck, supervisorOnly } = require('../middleware');

const router = express.Router();

router.use(auth);
router.use(tenantCheck);

async function listClients(req, res) {
  const { assigned, search } = req.query;
  const companyId = req.companyId;

  try {
    let query, params, i = 1;

    if (assigned === 'mine' && req.companyRole === 'operator') {
      query = `
        SELECT c.* FROM clients c
        INNER JOIN assignments a ON a.client_id = c.id
        WHERE a.operator_id = $${i++} AND c.company_id = $${i++}
        ORDER BY c.last_name ASC NULLS LAST
        LIMIT 200
      `;
      params = [req.user.id, companyId];
    } else if (search) {
      const s = `%${search}%`;
      query = `
        SELECT * FROM clients
        WHERE company_id = $${i++}
          AND (first_name ILIKE $${i++} OR last_name ILIKE $${i++} OR nickname ILIKE $${i++}
               OR organization ILIKE $${i++} OR phone ILIKE $${i++} OR normalized_phone ILIKE $${i++})
        ORDER BY last_name ASC NULLS LAST
        LIMIT 200
      `;
      params = [companyId, s, s, s, s, s, s];
    } else {
      query = 'SELECT * FROM clients WHERE company_id = $1 ORDER BY last_name ASC NULLS LAST LIMIT 200';
      params = [companyId];
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
      [req.params.id, req.companyId]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Client not found' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function listCalls(req, res) {
  const { client_id, operator_id } = req.query;
  const companyId = req.companyId;
  const userRole = req.companyRole;

  try {
    let conditions = [`ca.company_id = $1`];
    let params = [companyId];
    let i = 2;

    if (client_id) { conditions.push(`ca.client_id = $${i++}`); params.push(client_id); }
    if (operator_id) { conditions.push(`ca.operator_id = $${i++}`); params.push(operator_id); }
    if (userRole === 'operator') { conditions.push(`ca.operator_id = $${i++}`); params.push(req.user.id); }

    const { rows } = await pool.query(`
      SELECT ca.*,
             cl.first_name, cl.last_name, cl.organization, cl.phone,
             u.name AS operator_name
      FROM calls ca
      JOIN clients cl ON cl.id = ca.client_id
      JOIN users u ON u.id = ca.operator_id
      WHERE ${conditions.join(' AND ')}
      ORDER BY ca.created_at DESC
    `, params);

    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function createCall(req, res) {
  const { client_id, status, notes, scheduled_at, duration_seconds } = req.body;
  if (!client_id || !status) return res.status(400).json({ error: 'client_id and status required' });

  try {
    const { rows: clientCheck } = await pool.query(
      'SELECT id FROM clients WHERE id = $1 AND company_id = $2',
      [client_id, req.companyId]
    );
    if (clientCheck.length === 0) return res.status(404).json({ error: 'Client not found in this company' });

    const { rows } = await pool.query(`
      INSERT INTO calls (company_id, client_id, operator_id, status, notes, scheduled_at, duration_seconds)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `, [req.companyId, client_id, req.user.id, status, notes || null, scheduled_at || null, duration_seconds || null]);

    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function myStats(req, res) {
  try {
    const { rows: myCalls } = await pool.query(
      'SELECT status, client_id FROM calls WHERE operator_id = $1 AND company_id = $2',
      [req.user.id, req.companyId]
    );

    const { rows: [{ count: assigned }] } = await pool.query(
      'SELECT COUNT(*)::int AS count FROM assignments WHERE operator_id = $1 AND company_id = $2',
      [req.user.id, req.companyId]
    );

    const calledClients = new Set(myCalls.map(c => c.client_id));

    res.json({
      total_called: calledClients.size,
      total_attempts: myCalls.length,
      acepto: myCalls.filter(c => c.status === 'acepto').length,
      rechazo: myCalls.filter(c => c.status === 'rechazo').length,
      no_contesta: myCalls.filter(c => c.status === 'no_contesta').length,
      numero_invalido: myCalls.filter(c => c.status === 'numero_invalido').length,
      ya_en_app: myCalls.filter(c => c.status === 'ya_en_app').length,
      assigned: assigned || 0
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function dashboard(req, res) {
  const companyId = req.companyId;

  try {
    const { rows: [{ count: totalClients }] } = await pool.query(
      'SELECT COUNT(*)::int AS count FROM clients WHERE company_id = $1',
      [companyId]
    );
    const { rows: [{ count: totalCalls }] } = await pool.query(
      'SELECT COUNT(*)::int AS count FROM calls WHERE company_id = $1',
      [companyId]
    );
    const { rows: distinctClients } = await pool.query(
      'SELECT DISTINCT client_id FROM calls WHERE company_id = $1',
      [companyId]
    );
    const clientsCalled = distinctClients.length;

    const today = new Date().toISOString().slice(0, 10);
    const { rows: [{ count: callsToday }] } = await pool.query(
      "SELECT COUNT(*)::int AS count FROM calls WHERE company_id = $1 AND created_at >= $2 AND created_at < ($2::date + interval '1 day')",
      [companyId, today]
    );

    const { rows: operators } = await pool.query(
      `SELECT u.id, u.name FROM users u
       INNER JOIN company_members cm ON cm.user_id = u.id
       WHERE cm.company_id = $1 AND cm.role = 'operator' AND u.active = true`,
      [companyId]
    );

    const byOperator = [];
    for (const op of operators) {
      const { rows: [{ count: assigned }] } = await pool.query(
        'SELECT COUNT(*)::int AS count FROM assignments WHERE operator_id = $1 AND company_id = $2',
        [op.id, companyId]
      );
      const { rows: opCalls } = await pool.query(
        'SELECT status, client_id FROM calls WHERE operator_id = $1 AND company_id = $2',
        [op.id, companyId]
      );
      const called = new Set(opCalls.map(c => c.client_id)).size;
      const acepto = opCalls.filter(c => c.status === 'acepto').length;
      byOperator.push({ id: op.id, name: op.name, assigned, called, attempts: opCalls.length, acepto });
    }

    const { rows: statusData } = await pool.query(
      'SELECT status FROM calls WHERE company_id = $1',
      [companyId]
    );
    const byStatus = {};
    for (const c of statusData) {
      byStatus[c.status] = (byStatus[c.status] || 0) + 1;
    }

    res.json({ totalClients: totalClients || 0, totalCalls: totalCalls || 0, clientsCalled, callsToday: callsToday || 0, byOperator, byStatus });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function operatorProgress(req, res) {
  const opId = parseInt(req.params.operatorId);
  const companyId = req.companyId;

  try {
    const { rows: clients } = await pool.query(`
      SELECT c.* FROM clients c
      INNER JOIN assignments a ON a.client_id = c.id
      WHERE a.operator_id = $1 AND c.company_id = $2
      ORDER BY c.last_name ASC NULLS LAST
    `, [opId, companyId]);

    if (clients.length === 0) return res.json([]);

    const result = [];
    for (const c of clients) {
      const { rows: calls } = await pool.query(
        'SELECT status, created_at FROM calls WHERE client_id = $1 AND company_id = $2 ORDER BY created_at DESC LIMIT 1',
        [c.id, companyId]
      );
      result.push({ ...c, last_status: calls[0]?.status || null, attempts: calls.length, last_call: calls[0]?.created_at || null });
    }
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function exportData(req, res) {
  const companyId = req.companyId;

  try {
    const { rows: clients } = await pool.query(
      'SELECT * FROM clients WHERE company_id = $1 ORDER BY last_name ASC NULLS LAST',
      [companyId]
    );
    const result = [];

    for (const c of clients) {
      const { rows: calls } = await pool.query(
        'SELECT status, created_at FROM calls WHERE client_id = $1 AND company_id = $2 ORDER BY created_at DESC LIMIT 1',
        [c.id, companyId]
      );
      const { rows: assignment } = await pool.query(
        'SELECT operator_id FROM assignments WHERE client_id = $1 AND company_id = $2 ORDER BY id DESC LIMIT 1',
        [c.id, companyId]
      );
      let assignedTo = '';
      if (assignment[0]) {
        const { rows: op } = await pool.query('SELECT name FROM users WHERE id = $1', [assignment[0].operator_id]);
        assignedTo = op[0]?.name || '';
      }
      result.push({
        first_name: c.first_name, last_name: c.last_name, organization: c.organization,
        phone: c.phone, normalized_phone: c.normalized_phone, city: c.city,
        last_status: calls[0]?.status || null,
        attempts: calls.length,
        last_call_date: calls[0]?.created_at || null,
        assigned_to: assignedTo
      });
    }
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

const fs = require('fs');
const path = require('path');
const multer = require('multer');
const { parse } = require('csv-parse/sync');
const bcrypt = require('bcryptjs');
const { normalizePhone, parseVCF } = require('../scripts/normalizer');

const upload = multer({ dest: path.join(__dirname, '../uploads/') });

async function importCSV(req, res) {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  const companyId = req.companyId;
  try {
    const content = fs.readFileSync(req.file.path, 'utf-8');
    const records = parse(content, { columns: true, skip_empty_lines: true, relax_column_count: true });
    let imported = 0, skipped = 0;

    for (const row of records) {
      const phone = row['Phone 1 - Value'] || '';
      const normalized = normalizePhone(phone);
      if (!normalized) { skipped++; continue; }

      const { rows: existing } = await pool.query(
        'SELECT id FROM clients WHERE normalized_phone = $1 AND company_id = $2 LIMIT 1',
        [normalized, companyId]
      );
      if (existing.length > 0) { skipped++; continue; }

      try {
        await pool.query(`
          INSERT INTO clients (company_id, first_name, middle_name, last_name, nickname, organization, email,
            phone, phone2, phone3, notes, city, region, country, source, normalized_phone)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
        `, [
          companyId, row['First Name'] || null, row['Middle Name'] || null, row['Last Name'] || null,
          row['Nickname'] || null, row['Organization Name'] || null, row['E-mail 1 - Value'] || null,
          phone || null, row['Phone 2 - Value'] || null, row['Phone 3 - Value'] || null,
          row['Notes'] || null, row['Address 1 - City'] || null, row['Address 1 - Region'] || null,
          row['Address 1 - Country'] || null, 'csv', normalized
        ]);
        imported++;
      } catch { skipped++; }
    }

    fs.unlinkSync(req.file.path);
    res.json({ imported, skipped });
  } catch (err) {
    if (req.file?.path) try { fs.unlinkSync(req.file.path); } catch {}
    res.status(500).json({ error: err.message });
  }
}

async function importVCF(req, res) {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  const companyId = req.companyId;
  try {
    const content = fs.readFileSync(req.file.path, 'utf-8');
    const contacts = parseVCF(content);
    let imported = 0, skipped = 0;

    for (const contact of contacts) {
      const phone = contact.phone || '';
      const normalized = normalizePhone(phone);
      if (!normalized) { skipped++; continue; }

      const { rows: existing } = await pool.query(
        'SELECT id FROM clients WHERE normalized_phone = $1 AND company_id = $2 LIMIT 1',
        [normalized, companyId]
      );
      if (existing.length > 0) { skipped++; continue; }

      try {
        await pool.query(`
          INSERT INTO clients (company_id, first_name, nickname, organization, phone, phone2, source, normalized_phone)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
        `, [companyId, contact.name || null, contact.name || null, contact.org || null, phone, contact.phone2 || null, 'vcf', normalized]);
        imported++;
      } catch { skipped++; }
    }

    fs.unlinkSync(req.file.path);
    res.json({ imported, skipped });
  } catch (err) {
    if (req.file?.path) try { fs.unlinkSync(req.file.path); } catch {}
    res.status(500).json({ error: err.message });
  }
}

async function assignClients(req, res) {
  const { client_ids, operator_id } = req.body;
  const companyId = req.companyId;
  if (!client_ids || !operator_id) return res.status(400).json({ error: 'client_ids and operator_id required' });

  try {
    const { rows: existing } = await pool.query(
      'SELECT client_id, operator_id FROM assignments WHERE operator_id = $1 AND company_id = $2 AND client_id = ANY($3)',
      [operator_id, companyId, client_ids]
    );
    const existingSet = new Set(existing.map(a => `${a.client_id}-${a.operator_id}`));
    let assigned = 0;

    for (const cid of client_ids) {
      if (existingSet.has(`${cid}-${operator_id}`)) continue;
      try {
        await pool.query(
          'INSERT INTO assignments (company_id, client_id, operator_id, assigned_by) VALUES ($1, $2, $3, $4)',
          [companyId, cid, parseInt(operator_id), req.user.id]
        );
        assigned++;
      } catch {}
    }
    res.json({ assigned });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function getUnassigned(req, res) {
  const companyId = req.companyId;
  try {
    const { rows } = await pool.query(`
      SELECT c.* FROM clients c
      LEFT JOIN assignments a ON a.client_id = c.id
      WHERE c.company_id = $1 AND a.id IS NULL
      ORDER BY c.last_name ASC NULLS LAST
      LIMIT 200
    `, [companyId]);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function getOperators(req, res) {
  const companyId = req.companyId;
  try {
    const { rows } = await pool.query(
      `SELECT u.id, u.name, u.username, u.active, cm.role FROM users u
       INNER JOIN company_members cm ON cm.user_id = u.id
       WHERE cm.company_id = $1 AND cm.role IN ('operator', 'supervisor')
       ORDER BY u.active DESC, cm.role DESC, u.name ASC`,
      [companyId]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function createOperator(req, res) {
  const { username, password, name, role } = req.body;
  const companyId = req.companyId;
  if (!username || !password || !name) return res.status(400).json({ error: 'All fields required' });

  const userRole = role && ['operator', 'supervisor'].includes(role) ? role : 'operator';

  try {
    const { rows: existing } = await pool.query(
      'SELECT id FROM users WHERE username = $1 AND primary_company_id = $2 LIMIT 1',
      [username, companyId]
    );
    if (existing.length > 0) return res.status(400).json({ error: 'Username already exists' });

    const hash = bcrypt.hashSync(password, 10);
    const { rows } = await pool.query(
      'INSERT INTO users (username, password, role, name, active, primary_company_id) VALUES ($1, $2, $3, $4, true, $5) RETURNING id',
      [username, hash, userRole, name, companyId]
    );

    await pool.query(
      'INSERT INTO company_members (company_id, user_id, role) VALUES ($1, $2, $3)',
      [companyId, rows[0].id, userRole]
    );

    res.status(201).json({ message: 'Operator created' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function updateOperator(req, res) {
  const { id } = req.params;
  const { name, username, password, active } = req.body;
  const companyId = req.companyId;

  if (!name && !username && !password && active === undefined) {
    return res.status(400).json({ error: 'At least one field required' });
  }

  try {
    const { rows: userCheck } = await pool.query(
      `SELECT u.id FROM users u
       INNER JOIN company_members cm ON cm.user_id = u.id
       WHERE u.id = $1 AND cm.company_id = $2`,
      [id, companyId]
    );
    if (userCheck.length === 0) return res.status(404).json({ error: 'Operator not found' });

    if (username) {
      const { rows: dup } = await pool.query(
        'SELECT id FROM users WHERE username = $1 AND primary_company_id = $2 AND id != $3 LIMIT 1',
        [username, companyId, id]
      );
      if (dup.length > 0) return res.status(400).json({ error: 'Username already exists' });
    }

    const updates = [];
    const params = [];
    let i = 1;
    if (name) { updates.push(`name = $${i++}`); params.push(name); }
    if (username) { updates.push(`username = $${i++}`); params.push(username); }
    if (password) { updates.push(`password = $${i++}`); params.push(bcrypt.hashSync(password, 10)); }
    if (active !== undefined) { updates.push(`active = $${i++}`); params.push(active); }

    if (updates.length > 0) {
      params.push(id);
      await pool.query(`UPDATE users SET ${updates.join(', ')} WHERE id = $${i}`, params);
    }

    const { rows: updated } = await pool.query(
      'SELECT u.id, u.username, u.name, u.active, cm.role FROM users u INNER JOIN company_members cm ON cm.user_id = u.id WHERE u.id = $1 AND cm.company_id = $2',
      [id, companyId]
    );
    res.json(updated[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function deleteOperator(req, res) {
  const { id } = req.params;
  const companyId = req.companyId;

  if (parseInt(id) === req.user.id) {
    return res.status(403).json({ error: 'Cannot deactivate yourself' });
  }

  try {
    const { rows: userCheck } = await pool.query(
      `SELECT u.id FROM users u
       INNER JOIN company_members cm ON cm.user_id = u.id
       WHERE u.id = $1 AND cm.company_id = $2`,
      [id, companyId]
    );
    if (userCheck.length === 0) return res.status(404).json({ error: 'Operator not found' });

    await pool.query('UPDATE users SET active = false WHERE id = $1', [id]);
    res.json({ message: 'Operator deactivated' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

router.get('/clients', listClients);
router.get('/clients/:id', getClient);
router.get('/calls', listCalls);
router.post('/calls', createCall);
router.get('/calls/stats/mine', myStats);
router.get('/reports/dashboard', dashboard);
router.get('/reports/operator/:operatorId', operatorProgress);
router.get('/reports/export', exportData);
router.post('/import/csv', supervisorOnly, upload.single('file'), importCSV);
router.post('/import/vcf', supervisorOnly, upload.single('file'), importVCF);
router.post('/import/assign', supervisorOnly, assignClients);
router.get('/import/unassigned', getUnassigned);
router.get('/import/operators', getOperators);
router.post('/import/operator', supervisorOnly, createOperator);
router.put('/import/operator/:id', supervisorOnly, updateOperator);
router.delete('/import/operator/:id', supervisorOnly, deleteOperator);

module.exports = router;
