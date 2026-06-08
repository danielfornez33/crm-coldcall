const fs = require('fs');
const path = require('path');
const multer = require('multer');
const { parse } = require('csv-parse/sync');
const bcrypt = require('bcryptjs');
const supabase = require('../supabase');
const { normalizePhone, parseVCF } = require('../scripts/normalizer');

const upload = multer({ dest: path.join(__dirname, '../uploads/') });

async function importCSV(req, res) {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  const content = fs.readFileSync(req.file.path, 'utf-8');
  const records = parse(content, { columns: true, skip_empty_lines: true, relax_column_count: true });

  let imported = 0, skipped = 0;

  for (const row of records) {
    const phone = row['Phone 1 - Value'] || '';
    const normalized = normalizePhone(phone);
    if (!normalized) { skipped++; continue; }

    const { data: existing } = await supabase
      .from('clients')
      .select('id')
      .eq('normalized_phone', normalized)
      .limit(1);

    if (existing?.length) { skipped++; continue; }

    const { error } = await supabase.from('clients').insert({
      first_name: row['First Name'] || null,
      middle_name: row['Middle Name'] || null,
      last_name: row['Last Name'] || null,
      nickname: row['Nickname'] || null,
      organization: row['Organization Name'] || null,
      email: row['E-mail 1 - Value'] || null,
      phone: phone || null,
      phone2: row['Phone 2 - Value'] || null,
      phone3: row['Phone 3 - Value'] || null,
      notes: row['Notes'] || null,
      city: row['Address 1 - City'] || null,
      region: row['Address 1 - Region'] || null,
      country: row['Address 1 - Country'] || null,
      source: 'csv',
      normalized_phone: normalized
    });

    if (!error) imported++; else skipped++;
  }

  fs.unlinkSync(req.file.path);
  res.json({ imported, skipped });
}

async function importVCF(req, res) {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  const content = fs.readFileSync(req.file.path, 'utf-8');
  const contacts = parseVCF(content);

  let imported = 0, skipped = 0;

  for (const contact of contacts) {
    const phone = contact.phone || '';
    const normalized = normalizePhone(phone);
    if (!normalized) { skipped++; continue; }

    const { data: existing } = await supabase
      .from('clients')
      .select('id')
      .eq('normalized_phone', normalized)
      .limit(1);

    if (existing?.length) { skipped++; continue; }

    const { error } = await supabase.from('clients').insert({
      first_name: contact.name || null,
      nickname: contact.name || null,
      organization: contact.org || null,
      phone: phone,
      phone2: contact.phone2 || null,
      source: 'vcf',
      normalized_phone: normalized
    });

    if (!error) imported++; else skipped++;
  }

  fs.unlinkSync(req.file.path);
  res.json({ imported, skipped });
}

async function assignClients(req, res) {
  const { client_ids, operator_id } = req.body;
  if (!client_ids || !operator_id) return res.status(400).json({ error: 'client_ids and operator_id required' });

  const { data: existing } = await supabase
    .from('assignments')
    .select('client_id, operator_id')
    .eq('operator_id', operator_id)
    .in('client_id', client_ids);

  const existingSet = new Set(existing?.map(a => `${a.client_id}-${a.operator_id}`) || []);
  let assigned = 0;

  for (const cid of client_ids) {
    if (existingSet.has(`${cid}-${operator_id}`)) continue;
    const { error } = await supabase.from('assignments').insert({
      client_id: cid,
      operator_id: parseInt(operator_id),
      assigned_by: req.user.id
    });
    if (!error) assigned++;
  }

  res.json({ assigned });
}

async function getUnassigned(req, res) {
  const { data: assigned } = await supabase.from('assignments').select('client_id');
  const assignedIds = new Set(assigned?.map(a => a.client_id) || []);

  if (assignedIds.size === 0) {
    const { data } = await supabase.from('clients').select('*').order('last_name').limit(200);
    return res.json(data || []);
  }

  const { data } = await supabase
    .from('clients')
    .select('*')
    .not('id', 'in', `(${[...assignedIds].join(',')})`)
    .order('last_name')
    .limit(200);

  res.json(data || []);
}

async function getOperators(req, res) {
  if (req.user.role !== 'supervisor') return res.json([]);
  const { data } = await supabase
    .from('users')
    .select('id, name, username')
    .eq('role', 'operator')
    .eq('active', true);
  res.json(data || []);
}

async function createOperator(req, res) {
  const { username, password, name } = req.body;
  if (!username || !password || !name) return res.status(400).json({ error: 'All fields required' });

  const { data: existing } = await supabase.from('users').select('id').eq('username', username).limit(1);
  if (existing?.length) return res.status(400).json({ error: 'Username already exists' });

  const hash = bcrypt.hashSync(password, 10);
  const { error } = await supabase.from('users').insert({
    username, password: hash, role: 'operator', name, active: true
  });

  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json({ message: 'Operator created' });
}

module.exports = { importCSV, importVCF, assignClients, getUnassigned, getOperators, createOperator };
