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
    console.error('❌ Admin login error:', adminErr.message);
    process.exit(1);
  }
  console.log('✅ Admin authenticated!');

  const freshUsername = 'testuser1';
  const freshPassword = 'Ravva@1234';
  const freshName = 'Test User 1';

  console.log(`\n2. Creating fresh employee username "${freshUsername}" with password "${freshPassword}" via RPC...`);
  const { data: createRes, error: createErr } = await client.rpc('admin_create_employee', {
    p_full_name: freshName,
    p_username: freshUsername,
    p_password: freshPassword,
    p_is_active: true
  });

  console.log('Create RPC Result:', createRes, createErr);

  // Sign out admin
  await client.auth.signOut();

  // Test sign in for 'testuser1'
  console.log(`\n3. Testing employee sign-in for username "${freshUsername}" with password "${freshPassword}"...`);
  const { data: empAuth, error: empErr } = await client.auth.signInWithPassword({
    email: `${freshUsername}@vkit.local`,
    password: freshPassword
  });

  if (empErr) {
    console.error(`❌ Employee "${freshUsername}" sign-in failed:`, empErr.message);
  } else {
    console.log(`🎉🎉🎉 SUCCESS! Employee "${freshUsername}" logged in successfully! User ID: ${empAuth.user.id}`);
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
