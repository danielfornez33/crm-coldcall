const supabase = require('../supabase');

async function dashboard(req, res) {
  const { count: totalClients } = await supabase.from('clients').select('*', { count: 'exact', head: true });
  const { count: totalCalls } = await supabase.from('calls').select('*', { count: 'exact', head: true });

  const { data: callsDistinct } = await supabase.from('calls').select('client_id');
  const clientsCalled = new Set((callsDistinct || []).map(c => c.client_id)).size;

  const today = new Date().toISOString().slice(0, 10);
  const { count: callsToday } = await supabase
    .from('calls')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', today)
    .lt('created_at', today + 'T23:59:59.999Z');

  const { data: operators } = await supabase
    .from('users')
    .select('id, name')
    .eq('role', 'operator')
    .eq('active', true);

  const byOperator = [];
  for (const op of operators) {
    const { count: assigned } = await supabase
      .from('assignments')
      .select('*', { count: 'exact', head: true })
      .eq('operator_id', op.id);

    const { data: opCalls } = await supabase
      .from('calls')
      .select('status, client_id')
      .eq('operator_id', op.id);

    const called = new Set((opCalls || []).map(c => c.client_id)).size;
    const acepto = (opCalls || []).filter(c => c.status === 'acepto').length;

    byOperator.push({
      id: op.id, name: op.name,
      assigned: assigned || 0,
      called,
      attempts: (opCalls || []).length,
      acepto
    });
  }

  const { data: statusData } = await supabase.from('calls').select('status');
  const byStatus = {};
  for (const c of statusData || []) {
    byStatus[c.status] = (byStatus[c.status] || 0) + 1;
  }

  res.json({
    totalClients: totalClients || 0,
    totalCalls: totalCalls || 0,
    clientsCalled,
    callsToday: callsToday || 0,
    byOperator,
    byStatus
  });
}

async function operatorProgress(req, res) {
  const opId = parseInt(req.params.id);
  const { data: assignments } = await supabase
    .from('assignments')
    .select('client_id')
    .eq('operator_id', opId);

  const ids = (assignments || []).map(a => a.client_id);
  if (ids.length === 0) return res.json([]);

  const { data: clients } = await supabase
    .from('clients')
    .select('*')
    .in('id', ids)
    .order('last_name');

  const result = [];
  for (const c of clients || []) {
    const { data: calls } = await supabase
      .from('calls')
      .select('status, created_at')
      .eq('client_id', c.id)
      .order('created_at', { ascending: false })
      .limit(1);

    result.push({
      ...c,
      last_status: calls?.[0]?.status || null,
      attempts: calls?.length || 0,
      last_call: calls?.[0]?.created_at || null
    });
  }

  res.json(result);
}

async function exportData(req, res) {
  const { data: clients } = await supabase.from('clients').select('*').order('last_name');
  const result = [];

  for (const c of clients || []) {
    const { data: calls } = await supabase
      .from('calls')
      .select('status, created_at')
      .eq('client_id', c.id)
      .order('created_at', { ascending: false })
      .limit(1);

    const { data: assignment } = await supabase
      .from('assignments')
      .select('operator_id')
      .eq('client_id', c.id)
      .order('id', { ascending: false })
      .limit(1);

    let assignedTo = '';
    if (assignment?.[0]) {
      const { data: op } = await supabase.from('users').select('name').eq('id', assignment[0].operator_id).single();
      assignedTo = op?.name || '';
    }

    result.push({
      first_name: c.first_name, last_name: c.last_name, organization: c.organization,
      phone: c.phone, normalized_phone: c.normalized_phone, city: c.city,
      last_status: calls?.[0]?.status || null,
      attempts: (calls || []).length,
      last_call_date: calls?.[0]?.created_at || null,
      assigned_to: assignedTo
    });
  }

  res.json(result);
}

module.exports = { dashboard, operatorProgress, exportData };
