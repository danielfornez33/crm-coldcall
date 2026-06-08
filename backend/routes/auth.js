const supabase = require('../supabase');

async function login(req, res) {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Username and password required' });

  const bcrypt = require('bcryptjs');
  const jwt = require('jsonwebtoken');
  const { SECRET } = require('../middleware');

  const { data: users, error } = await supabase
    .from('users')
    .select('*')
    .eq('username', username)
    .eq('active', true)
    .limit(1);

  if (error) return res.status(500).json({ error: error.message });
  const user = users?.[0];
  if (!user || !bcrypt.compareSync(password, user.password)) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const token = jwt.sign(
    { id: user.id, username: user.username, role: user.role, name: user.name },
    SECRET,
    { expiresIn: '24h' }
  );
  res.json({ token, user: { id: user.id, username: user.username, role: user.role, name: user.name } });
}

async function me(req, res) {
  const { data: user, error } = await supabase
    .from('users')
    .select('id, username, role, name')
    .eq('id', req.user.id)
    .single();

  if (error || !user) return res.status(404).json({ error: 'User not found' });
  res.json(user);
}

async function getUsers(req, res) {
  if (req.user.role !== 'supervisor') return res.json([]);
  const { data, error } = await supabase.from('users').select('id, username, role, name, active');
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
}

module.exports = { login, me, getUsers };
