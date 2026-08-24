import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;
const client = createClient(supabaseUrl, supabaseAnonKey);

async function main() {
  // Admin login
  const { error: adminErr } = await client.auth.signInWithPassword({
    email: 'admin@vkit.local',
    password: 'Krrish@@1999'
  });
  if (adminErr) { console.error('Admin error:', adminErr.message); process.exit(1); }
  console.log('✅ Admin authenticated!\n');

  // Check what's in auth.users for test1 by querying profiles
  const { data: profiles } = await client.from('profiles').select('id, username, full_name');
  console.log('All profiles:', profiles?.map(p => ({ id: p.id, username: p.username })));

  const test1Profile = profiles?.find(p => p.username === 'test1');
  console.log('\ntest1 profile:', test1Profile);

  if (test1Profile) {
    // The profile exists but auth user is corrupted - delete it directly
    console.log('\nDeleting corrupted test1 account...');
    const { data: delRes, error: delErr } = await client.rpc('admin_delete_employee', {
      p_employee_id: test1Profile.id
    });
    console.log('Delete result:', delRes, delErr);
  }

  // Now check auth.users directly via SQL
  console.log('\nChecking auth.users for test1@vkit.local...');
  const { data: sqlRes, error: sqlErr } = await client.rpc('exec_sql_check', {
    p_email: 'test1@vkit.local'
  });
  console.log('SQL Check result:', sqlRes, sqlErr);
}

main().catch(console.error);
