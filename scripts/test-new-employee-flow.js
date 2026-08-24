import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

const client = createClient(supabaseUrl, supabaseAnonKey);

async function main() {
  console.log('1. Admin login...');
  const { data: adminAuth, error: adminErr } = await client.auth.signInWithPassword({
    email: 'admin@vkit.local',
    password: 'Krrish@@1999'
  });

  if (adminErr) {
    console.error('❌ Admin login error:', adminErr.message);
    process.exit(1);
  }
  console.log('✅ Admin logged in!');

  // Create new employee 'ravva' with password 'Ravva@1234'
  const newUsername = 'ravva';
  const newPassword = 'Ravva@1234';
  const newName = 'Ravva Employee';

  console.log(`\n2. Creating new employee username "${newUsername}" with password "${newPassword}"...`);
  const { data: createRes, error: createErr } = await client.rpc('admin_create_employee', {
    p_full_name: newName,
    p_username: newUsername,
    p_password: newPassword,
    p_is_active: true
  });

  console.log('Create RPC Result:', createRes, createErr);

  // Sign out admin
  await client.auth.signOut();

  // Test sign in for new employee 'ravva'
  console.log(`\n3. Testing employee sign-in for username "${newUsername}" with password "${newPassword}"...`);
  const { data: empAuth, error: empErr } = await client.auth.signInWithPassword({
    email: `${newUsername}@vkit.local`,
    password: newPassword
  });

  if (empErr) {
    console.error(`❌ Employee "${newUsername}" sign-in failed:`, empErr.message);
  } else {
    console.log(`🎉 SUCCESS! Employee "${newUsername}" logged in successfully! User ID: ${empAuth.user.id}`);
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
