require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const bcrypt = require('bcryptjs');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function main() {
  console.log('Checking Supabase tables...');

  const { data: users, error } = await supabase.from('users').select('id').limit(1);
  if (error && error.code === '42P01') {
    console.log('\nTables do not exist!');
    console.log('Run migration.sql in your Supabase SQL Editor:');
    console.log('  https://supabase.com/dashboard/project/' + process.env.SUPABASE_URL?.split('.')[0]?.replace('https://', '') + '/sql/new');
    process.exit(1);
  }

  const { data: existing } = await supabase.from('users').select('username').in('username', ['admin', 'operador1']);
  const existingUsernames = new Set(existing?.map(u => u.username) || []);

  if (!existingUsernames.has('admin')) {
    const hash = bcrypt.hashSync('admin123', 10);
    await supabase.from('users').insert({ username: 'admin', password: hash, role: 'supervisor', name: 'Supervisor' });
    console.log('Created admin user');
  }

  if (!existingUsernames.has('operador1')) {
    const hash = bcrypt.hashSync('operador1', 10);
    await supabase.from('users').insert({ username: 'operador1', password: hash, role: 'operator', name: 'Operador 1' });
    console.log('Created operador1 user');
  }

  console.log('Setup complete!');
}

main().catch(console.error);
