import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;
const client = createClient(supabaseUrl, supabaseAnonKey);

async function main() {
  console.log('1. Admin signing in...');
  const { error: adminErr } = await client.auth.signInWithPassword({
    email: 'admin@vkit.local',
    password: 'Krrish@@1999'
  });
  if (adminErr) { console.error('Admin error:', adminErr.message); process.exit(1); }
  console.log('✅ Admin authenticated!\n');

  // Step 1: Delete all corrupted test/ravva accounts via admin_delete_employee
  const { data: profiles } = await client.from('profiles').select('id, username, full_name');
  const toDelete = profiles?.filter(p =>
    ['test1', 'test 1', 'testuser1', 'ravva', 'ravvaemployee', 'testone'].includes(p.username?.toLowerCase()) ||
    p.full_name?.toLowerCase().includes('test') ||
    p.full_name?.toLowerCase().includes('ravva')
  );

  console.log(`Found ${toDelete?.length || 0} accounts to purge:`, toDelete?.map(p => p.username));

  for (const p of (toDelete || [])) {
    const { data: delRes } = await client.rpc('admin_delete_employee', { p_employee_id: p.id });
    console.log(`  Delete "${p.username}" (${p.id}):`, delRes);
  }

  // Step 2: Create fresh test1 with the FIXED function
  console.log('\n2. Creating fresh employee "test1" with password "Ravva@1234"...');
  const { data: createRes, error: createErr } = await client.rpc('admin_create_employee', {
    p_full_name: 'Test 1',
    p_username: 'test1',
    p_password: 'Ravva@1234',
    p_is_active: true
  });
  console.log('Create result:', createRes, createErr);

  await client.auth.signOut();

  // Step 3: Test login
  console.log('\n3. Testing login for username "test1" password "Ravva@1234"...');
  const { data: loginData, error: loginErr } = await client.auth.signInWithPassword({
    email: 'test1@vkit.local',
    password: 'Ravva@1234'
  });

  if (loginErr) {
    console.error('❌ LOGIN FAILED:', loginErr.message);
  } else {
    console.log('🎉🎉🎉 SUCCESS! test1 logged in! User ID:', loginData.user.id);
  }
}

main().catch(console.error);
