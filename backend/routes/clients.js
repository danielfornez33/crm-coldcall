const supabase = require('../supabase');

async function listClients(req, res) {
  const { assigned, search } = req.query;

  let query = supabase.from('clients').select('*').order('last_name', { ascending: true }).limit(200);

  if (assigned === 'mine' && req.user.role === 'operator') {
    const { data: assignments } = await supabase
      .from('assignments')
      .select('client_id')
      .eq('operator_id', req.user.id);
    const ids = assignments?.map(a => a.client_id) || [];
    if (ids.length === 0) return res.json([]);
    query = query.in('id', ids);
  }

  if (search) {
    const s = `%${search}%`;
    query = query.or(`first_name.ilike.${s},last_name.ilike.${s},nickname.ilike.${s},organization.ilike.${s},phone.ilike.${s},normalized_phone.ilike.${s}`);
  }

  const { data, error } = await query;
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
}

async function getClient(req, res) {
  const { data, error } = await supabase.from('clients').select('*').eq('id', req.params.id).single();
  if (error || !data) return res.status(404).json({ error: 'Client not found' });
  res.json(data);
}

module.exports = { listClients, getClient };
