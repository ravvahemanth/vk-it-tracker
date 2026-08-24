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

  const testUsername = 'test1';
  const testPassword = 'Ravva@1234';
  const testName = 'Test 1 Employee';

  console.log(`\n2. Creating employee username "${testUsername}" with password "${testPassword}" via RPC...`);
  const { data: createRes, error: createErr } = await client.rpc('admin_create_employee', {
    p_full_name: testName,
    p_username: testUsername,
    p_password: testPassword,
    p_is_active: true
  });

  console.log('RPC Response:', createRes, createErr);

  // Sign out admin
  await client.auth.signOut();

  // Test sign in for 'test1'
  console.log(`\n3. Testing live employee sign-in for username "${testUsername}" with password "${testPassword}"...`);
  const { data: empAuth, error: empErr } = await client.auth.signInWithPassword({
    email: `${testUsername}@vkit.local`,
    password: testPassword
  });

  if (empErr) {
    console.error(`❌ Sign-in failed:`, empErr.message);
  } else {
    console.log(`🎉🎉 SUCCESS! Employee "${testUsername}" logged in successfully! User ID: ${empAuth.user.id}`);
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
