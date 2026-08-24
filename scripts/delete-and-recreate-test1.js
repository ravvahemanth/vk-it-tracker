import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

const client = createClient(supabaseUrl, supabaseAnonKey);

async function main() {
  console.log('1. Admin signing in...');
  const { data: adminAuth, error: adminErr } = await client.auth.signInWithPassword({
    email: 'admin@vkit.local',
    password: 'Krrish@@1999'
  });

  if (adminErr) {
    console.error('Admin login error:', adminErr);
    process.exit(1);
  }
  console.log('✅ Admin authenticated!');

  // Fetch profiles to get test1 profile ID
  const { data: profiles } = await client.from('profiles').select('*');
  const targetProfile = profiles?.find(p => p.username === 'test1' || p.username === 'test 1');

  if (targetProfile) {
    console.log(`Found corrupted profile (ID: ${targetProfile.id}, username: "${targetProfile.username}"). Deleting...`);
    const { data: delRes, error: delErr } = await client.rpc('admin_delete_employee', {
      p_employee_id: targetProfile.id
    });
    console.log('Delete RPC Result:', delRes, delErr);
  } else {
    console.log('No existing test1 profile found in public.profiles.');
  }

  // Now create clean employee 'test1' with password 'Ravva@1234'
  console.log('\n2. Creating clean employee username "test1" with password "Ravva@1234"...');
  const { data: createRes, error: createErr } = await client.rpc('admin_create_employee', {
    p_full_name: 'Test 1 Employee',
    p_username: 'test1',
    p_password: 'Ravva@1234',
    p_is_active: true
  });

  console.log('Create RPC Result:', createRes, createErr);

  // Sign out admin
  await client.auth.signOut();

  // Test sign in for 'test1'
  console.log('\n3. Testing employee sign-in for username "test1" with password "Ravva@1234"...');
  const { data: empAuth, error: empErr } = await client.auth.signInWithPassword({
    email: 'test1@vkit.local',
    password: 'Ravva@1234'
  });

  if (empErr) {
    console.error('❌ Sign-in failed:', empErr.message);
  } else {
    console.log(`🎉🎉 SUCCESS! Employee "test1" logged in successfully! User ID: ${empAuth.user.id}`);
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
