import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

const client = createClient(supabaseUrl, supabaseAnonKey);

async function main() {
  console.log('1. Admin login...');
  const { data: adminData, error: adminErr } = await client.auth.signInWithPassword({
    email: 'admin@vkit.local',
    password: 'Krrish@@1999'
  });

  if (adminErr) {
    console.error('Admin login error:', adminErr);
    process.exit(1);
  }
  console.log('✅ Admin authenticated!');

  // Check profiles for any test profile
  const { data: profiles } = await client.from('profiles').select('*');
  const oldTest = profiles?.find(p => p.username === 'test 1' || p.username === 'test1' || p.full_name?.toLowerCase().includes('test'));

  if (oldTest) {
    console.log(`Deleting old test profile (ID: ${oldTest.id}, username: "${oldTest.username}")...`);
    const { data: delData, error: delErr } = await client.rpc('admin_delete_employee', {
      p_employee_id: oldTest.id
    });
    console.log('Delete result:', delData, delErr);
  }

  // Now create clean employee 'test1' with password 'Ravva@1234'
  console.log('\n2. Creating clean employee account for username "test1" with password "Ravva@1234"...');
  const { data: createData, error: createErr } = await client.rpc('admin_create_employee', {
    p_full_name: 'Test 1 Employee',
    p_username: 'test1',
    p_password: 'Ravva@1234',
    p_is_active: true
  });

  console.log('Create RPC Result:', createData, createErr);

  // Sign out admin
  await client.auth.signOut();

  // Test Employee Sign-In
  console.log('\n3. Testing employee sign-in as username "test1" with password "Ravva@1234"...');
  const { data: empData, error: empErr } = await client.auth.signInWithPassword({
    email: 'test1@vkit.local',
    password: 'Ravva@1234'
  });

  if (empErr) {
    console.error('❌ Sign-in failed:', empErr.message);
  } else {
    console.log(`🎉 SUCCESS! Employee logged in successfully! User ID: ${empData.user.id}`);
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
