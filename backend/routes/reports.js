const express = require('express');
const pool = require('../db');
const { auth } = require('../middleware');

const router = express.Router();
router.use(auth);

async function dashboard(req, res) {
  try {
    const { rows: [{ count: totalClients }] } = await pool.query('SELECT COUNT(*)::int AS count FROM clients');
    const { rows: [{ count: totalCalls }] } = await pool.query('SELECT COUNT(*)::int AS count FROM calls');

    const { rows: distinctClients } = await pool.query('SELECT DISTINCT client_id FROM calls');
    const clientsCalled = distinctClients.length;

    const today = new Date().toISOString().slice(0, 10);
    const { rows: [{ count: callsToday }] } = await pool.query(
      "SELECT COUNT(*)::int AS count FROM calls WHERE created_at >= $1 AND created_at < ($1::date + interval '1 day')",
      [today]
    );

    const { rows: operators } = await pool.query(
      "SELECT id, name FROM users WHERE role = 'operator' AND active = true"
    );

    const byOperator = [];
    for (const op of operators) {
      const { rows: [{ count: assigned }] } = await pool.query(
        'SELECT COUNT(*)::int AS count FROM assignments WHERE operator_id = $1',
        [op.id]
      );

      const { rows: opCalls } = await pool.query(
        'SELECT status, client_id FROM calls WHERE operator_id = $1',
        [op.id]
      );

      const called = new Set(opCalls.map(c => c.client_id)).size;
      const acepto = opCalls.filter(c => c.status === 'acepto').length;

      byOperator.push({
        id: op.id, name: op.name,
        assigned,
        called,
        attempts: opCalls.length,
        acepto
      });
    }

    const { rows: statusData } = await pool.query('SELECT status FROM calls');
    const byStatus = {};
    for (const c of statusData) {
      byStatus[c.status] = (byStatus[c.status] || 0) + 1;
    }

    res.json({
      totalClients,
      totalCalls,
      clientsCalled,
      callsToday,
      byOperator,
      byStatus
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function operatorProgress(req, res) {
  const opId = parseInt(req.params.id);
  try {
    const { rows: clients } = await pool.query(`
      SELECT c.* FROM clients c
      INNER JOIN assignments a ON a.client_id = c.id
      WHERE a.operator_id = $1
      ORDER BY c.last_name ASC NULLS LAST
    `, [opId]);

    if (clients.length === 0) return res.json([]);

    const result = [];
    for (const c of clients) {
      const { rows: calls } = await pool.query(
        'SELECT status, created_at FROM calls WHERE client_id = $1 ORDER BY created_at DESC LIMIT 1',
        [c.id]
      );

      result.push({
        ...c,
        last_status: calls[0]?.status || null,
        attempts: calls.length,
        last_call: calls[0]?.created_at || null
      });
    }

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function exportData(req, res) {
  try {
    const { rows: clients } = await pool.query('SELECT * FROM clients ORDER BY last_name ASC NULLS LAST');
    const result = [];

    for (const c of clients) {
      const { rows: calls } = await pool.query(
        'SELECT status, created_at FROM calls WHERE client_id = $1 ORDER BY created_at DESC LIMIT 1',
        [c.id]
      );

      const { rows: assignment } = await pool.query(
        'SELECT operator_id FROM assignments WHERE client_id = $1 ORDER BY id DESC LIMIT 1',
        [c.id]
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

router.get('/dashboard', dashboard);
router.get('/operator/:id', operatorProgress);
router.get('/export', exportData);

module.exports = router;
