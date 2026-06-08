const jwt = require('jsonwebtoken');

const SECRET = process.env.JWT_SECRET || 'highfil-crm-secret-2026';

function auth(req, res, next) {
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

function supervisorOnly(req, res, next) {
  if (req.user.role !== 'supervisor') {
    return res.status(403).json({ error: 'Supervisor only' });
  }
  next();
}

module.exports = { auth, supervisorOnly, SECRET };
