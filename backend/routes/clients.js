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
        ORDER BY c.last_name ASC NULLS LAST
        LIMIT 200
      `;
      params = [req.user.id];
    } else if (search) {
      const s = `%${search}%`;
      query = `
        SELECT * FROM clients
        WHERE first_name ILIKE $1 OR last_name ILIKE $1 OR nickname ILIKE $1
           OR organization ILIKE $1 OR phone ILIKE $1 OR normalized_phone ILIKE $1
        ORDER BY last_name ASC NULLS LAST
        LIMIT 200
      `;
      params = [s];
    } else {
      query = 'SELECT * FROM clients ORDER BY last_name ASC NULLS LAST LIMIT 200';
      params = [];
    }

    const { rows } = await pool.query(query, params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function getClient(req, res) {
  try {
    const { rows } = await pool.query('SELECT * FROM clients WHERE id = $1', [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Client not found' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

router.get('/', listClients);
router.get('/:id', getClient);

module.exports = router;
