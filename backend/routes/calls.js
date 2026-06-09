const express = require('express');
const pool = require('../db');
const { auth } = require('../middleware');

const router = express.Router();
router.use(auth);

async function listCalls(req, res) {
  const { client_id, operator_id } = req.query;

  try {
    let conditions = [];
    let params = [];
    let i = 1;

    if (client_id) {
      conditions.push(`ca.client_id = $${i++}`);
      params.push(client_id);
    }
    if (operator_id) {
      conditions.push(`ca.operator_id = $${i++}`);
      params.push(operator_id);
    }
    if (req.user.role === 'operator') {
      conditions.push(`ca.operator_id = $${i++}`);
      params.push(req.user.id);
    }

    const where = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';

    const { rows } = await pool.query(`
      SELECT ca.*,
             cl.first_name, cl.last_name, cl.organization, cl.phone,
             u.name AS operator_name
      FROM calls ca
      JOIN clients cl ON cl.id = ca.client_id
      JOIN users u ON u.id = ca.operator_id
      ${where}
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
    const { rows } = await pool.query(`
      INSERT INTO calls (client_id, operator_id, status, notes, scheduled_at, duration_seconds)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `, [parseInt(client_id), req.user.id, status, notes || null, scheduled_at || null, duration_seconds || null]);

    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function myStats(req, res) {
  try {
    const { rows: myCalls } = await pool.query(
      'SELECT status, client_id FROM calls WHERE operator_id = $1',
      [req.user.id]
    );

    const { rows: assignCount } = await pool.query(
      'SELECT COUNT(*)::int AS count FROM assignments WHERE operator_id = $1',
      [req.user.id]
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
      assigned: assignCount[0]?.count || 0
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

router.get('/', listCalls);
router.post('/', createCall);
router.get('/stats/mine', myStats);

module.exports = router;
