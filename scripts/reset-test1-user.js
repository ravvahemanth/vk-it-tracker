import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

const client = createClient(supabaseUrl, supabaseAnonKey);

async function main() {
  console.log('1. Signing in as Admin...');
  const { data: adminAuth, error: adminErr } = await client.auth.signInWithPassword({
    email: 'admin@vkit.local',
    password: 'Krrish@@1999'
  });

  if (adminErr) {
    console.error('Admin login error:', adminErr);
    process.exit(1);
  }

  console.log('✅ Admin signed in!');

  // Find profile with username 'test 1' or 'test1'
  const { data: profiles, error: pErr } = await client.from('profiles').select('*');
  console.log('Profiles list:', profiles.map(p => ({ id: p.id, username: p.username, name: p.full_name })));

  const testProfile = profiles?.find(p => p.username === 'test 1' || p.username === 'test1' || p.full_name === 'Test1');

  if (!testProfile) {
    console.log('Test1 profile not found, creating via admin_create_employee RPC...');
    const { data: createRes, error: createErr } = await client.rpc('admin_create_employee', {
      p_full_name: 'Test 1 Employee',
      p_username: 'test1',
      p_password: 'Ravva@1234',
      p_is_active: true
    });
    console.log('Create result:', createRes, createErr);
  } else {
    console.log(`Found test1 profile (ID: ${testProfile.id}). Resetting password to Ravva@1234...`);
    const { data: resetRes, error: resetErr } = await client.rpc('admin_reset_employee_password', {
      p_employee_id: testProfile.id,
      p_new_password: 'Ravva@1234'
    });
    console.log('Reset result:', resetRes, resetErr);

    console.log('Updating username from "test 1" to "test1"...');
    const { data: updateRes, error: updateErr } = await client.rpc('admin_update_employee', {
      p_employee_id: testProfile.id,
      p_full_name: testProfile.full_name,
      p_username: 'test1',
      p_is_active: true
    });
    console.log('Update result:', updateRes, updateErr);
  }

  // Sign out admin
  await client.auth.signOut();

  // Test sign in as test1
  console.log('\n2. Testing employee sign-in as username "test1" with password "Ravva@1234"...');
  const { data: empAuth, error: empErr } = await client.auth.signInWithPassword({
    email: 'test1@vkit.local',
    password: 'Ravva@1234'
  });

  if (empErr) {
    console.error('❌ Employee sign-in failed:', empErr.message);
  } else {
    console.log(`🎉 SUCCESS! Employee logged in successfully! User ID: ${empAuth.user.id}`);
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
