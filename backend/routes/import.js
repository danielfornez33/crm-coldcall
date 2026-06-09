const fs = require('fs');
const path = require('path');
const express = require('express');
const multer = require('multer');
const { parse } = require('csv-parse/sync');
const bcrypt = require('bcryptjs');
const pool = require('../db');
const { normalizePhone, parseVCF } = require('../scripts/normalizer');
const { auth, supervisorOnly } = require('../middleware');

const router = express.Router();
router.use(auth);

const upload = multer({ dest: path.join(__dirname, '../uploads/') });

async function importCSV(req, res) {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  try {
    const content = fs.readFileSync(req.file.path, 'utf-8');
    const records = parse(content, { columns: true, skip_empty_lines: true, relax_column_count: true });

    let imported = 0, skipped = 0;

    for (const row of records) {
      const phone = row['Phone 1 - Value'] || '';
      const normalized = normalizePhone(phone);
      if (!normalized) { skipped++; continue; }

      const { rows: existing } = await pool.query(
        'SELECT id FROM clients WHERE normalized_phone = $1 LIMIT 1',
        [normalized]
      );

      if (existing.length > 0) { skipped++; continue; }

      try {
        await pool.query(`
          INSERT INTO clients (first_name, middle_name, last_name, nickname, organization, email,
            phone, phone2, phone3, notes, city, region, country, source, normalized_phone)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
        `, [
          row['First Name'] || null,
          row['Middle Name'] || null,
          row['Last Name'] || null,
          row['Nickname'] || null,
          row['Organization Name'] || null,
          row['E-mail 1 - Value'] || null,
          phone || null,
          row['Phone 2 - Value'] || null,
          row['Phone 3 - Value'] || null,
          row['Notes'] || null,
          row['Address 1 - City'] || null,
          row['Address 1 - Region'] || null,
          row['Address 1 - Country'] || null,
          'csv',
          normalized
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
  try {
    const content = fs.readFileSync(req.file.path, 'utf-8');
    const contacts = parseVCF(content);

    let imported = 0, skipped = 0;

    for (const contact of contacts) {
      const phone = contact.phone || '';
      const normalized = normalizePhone(phone);
      if (!normalized) { skipped++; continue; }

      const { rows: existing } = await pool.query(
        'SELECT id FROM clients WHERE normalized_phone = $1 LIMIT 1',
        [normalized]
      );

      if (existing.length > 0) { skipped++; continue; }

      try {
        await pool.query(`
          INSERT INTO clients (first_name, nickname, organization, phone, phone2, source, normalized_phone)
          VALUES ($1,$2,$3,$4,$5,$6,$7)
        `, [
          contact.name || null,
          contact.name || null,
          contact.org || null,
          phone,
          contact.phone2 || null,
          'vcf',
          normalized
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

async function assignClients(req, res) {
  const { client_ids, operator_id } = req.body;
  if (!client_ids || !operator_id) return res.status(400).json({ error: 'client_ids and operator_id required' });

  try {
    const { rows: existing } = await pool.query(
      'SELECT client_id, operator_id FROM assignments WHERE operator_id = $1 AND client_id = ANY($2)',
      [operator_id, client_ids]
    );

    const existingSet = new Set(existing.map(a => `${a.client_id}-${a.operator_id}`));
    let assigned = 0;

    for (const cid of client_ids) {
      if (existingSet.has(`${cid}-${operator_id}`)) continue;
      try {
        await pool.query(
          'INSERT INTO assignments (client_id, operator_id, assigned_by) VALUES ($1, $2, $3)',
          [cid, parseInt(operator_id), req.user.id]
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
  try {
    const { rows } = await pool.query(`
      SELECT c.* FROM clients c
      LEFT JOIN assignments a ON a.client_id = c.id
      WHERE a.id IS NULL
      ORDER BY c.last_name ASC NULLS LAST
      LIMIT 200
    `);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function getOperators(req, res) {
  if (req.user.role !== 'supervisor') return res.json([]);
  try {
    const { rows } = await pool.query(
      "SELECT id, name, username FROM users WHERE role = 'operator' AND active = true"
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function updateOperator(req, res) {
  const { id } = req.params;
  const { name, username, password, active } = req.body;

  if (!name && !username && !password && active === undefined) {
    return res.status(400).json({ error: 'At least one field required' });
  }

  try {
    const { rows: existing } = await pool.query('SELECT id FROM users WHERE id = $1', [id]);
    if (existing.length === 0) return res.status(404).json({ error: 'Operator not found' });

    if (username) {
      const { rows: dup } = await pool.query(
        'SELECT id FROM users WHERE username = $1 AND id != $2 LIMIT 1',
        [username, id]
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
      'SELECT id, username, role, name, active FROM users WHERE id = $1',
      [id]
    );

    res.json(updated[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function deleteOperator(req, res) {
  const { id } = req.params;

  if (parseInt(id) === req.user.id) {
    return res.status(403).json({ error: 'Cannot deactivate yourself' });
  }

  try {
    const { rows: existing } = await pool.query('SELECT id FROM users WHERE id = $1', [id]);
    if (existing.length === 0) return res.status(404).json({ error: 'Operator not found' });

    await pool.query('UPDATE users SET active = false WHERE id = $1', [id]);
    res.json({ message: 'Operator deactivated' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function createOperator(req, res) {
  const { username, password, name } = req.body;
  if (!username || !password || !name) return res.status(400).json({ error: 'All fields required' });

  try {
    const { rows: existing } = await pool.query(
      'SELECT id FROM users WHERE username = $1 LIMIT 1',
      [username]
    );
    if (existing.length > 0) return res.status(400).json({ error: 'Username already exists' });

    const hash = bcrypt.hashSync(password, 10);
    await pool.query(
      "INSERT INTO users (username, password, role, name, active) VALUES ($1, $2, 'operator', $3, true)",
      [username, hash, name]
    );

    res.status(201).json({ message: 'Operator created' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

router.post('/csv', supervisorOnly, upload.single('file'), importCSV);
router.post('/vcf', supervisorOnly, upload.single('file'), importVCF);
router.post('/assign', supervisorOnly, assignClients);
router.get('/unassigned', getUnassigned);
router.get('/operators', getOperators);
router.post('/operator', supervisorOnly, createOperator);
router.put('/operator/:id', supervisorOnly, updateOperator);
router.delete('/operator/:id', supervisorOnly, deleteOperator);

module.exports = router;
