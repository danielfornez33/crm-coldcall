const supabase = require('../supabase');

async function listCalls(req, res) {
  const { client_id, operator_id } = req.query;

  let query = supabase
    .from('calls')
    .select(`
      *,
      clients!inner(first_name, last_name, organization, phone),
      users!inner(name)
    `)
    .order('created_at', { ascending: false });

  if (client_id) query = query.eq('client_id', client_id);
  if (operator_id) query = query.eq('operator_id', operator_id);
  if (req.user.role === 'operator') query = query.eq('operator_id', req.user.id);

  const { data, error } = await query;
  if (error) return res.status(500).json({ error: error.message });

  const calls = (data || []).map(c => ({
    ...c,
    first_name: c.clients?.first_name,
    last_name: c.clients?.last_name,
    organization: c.clients?.organization,
    phone: c.clients?.phone,
    operator_name: c.users?.name,
    clients: undefined,
    users: undefined
  }));

  res.json(calls);
}

async function createCall(req, res) {
  const { client_id, status, notes, scheduled_at, duration_seconds } = req.body;
  if (!client_id || !status) return res.status(400).json({ error: 'client_id and status required' });

  const { data, error } = await supabase.from('calls').insert({
    client_id: parseInt(client_id),
    operator_id: req.user.id,
    status,
    notes: notes || null,
    scheduled_at: scheduled_at || null,
    duration_seconds: duration_seconds || null
  }).select().single();

  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json(data);
}

async function myStats(req, res) {
  const { data: myCalls, error: callsErr } = await supabase
    .from('calls')
    .select('status, client_id')
    .eq('operator_id', req.user.id);

  if (callsErr) return res.status(500).json({ error: callsErr.message });

  const { count: assigned, error: assignErr } = await supabase
    .from('assignments')
    .select('*', { count: 'exact', head: true })
    .eq('operator_id', req.user.id);

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
}

module.exports = { listCalls, createCall, myStats };
