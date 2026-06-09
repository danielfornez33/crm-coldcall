const express = require('express');
const pool = require('../db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { SECRET } = require('../middleware');

const router = express.Router();

async function login(req, res) {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Username and password required' });

  try {
    const { rows } = await pool.query(
      'SELECT * FROM users WHERE username = $1 AND active = true LIMIT 1',
      [username]
    );

    const user = rows[0];
    if (!user || !bcrypt.compareSync(password, user.password)) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role, name: user.name },
      SECRET,
      { expiresIn: '24h' }
    );
    res.json({ token, user: { id: user.id, username: user.username, role: user.role, name: user.name } });
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
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function getUsers(req, res) {
  if (req.user.role !== 'supervisor') return res.json([]);
  try {
    const { rows } = await pool.query('SELECT id, username, role, name, active FROM users');
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
