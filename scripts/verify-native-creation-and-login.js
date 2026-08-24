import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

const client = createClient(supabaseUrl, supabaseAnonKey);

async function main() {
  const testUsername = 'testuser2026';
  const testPassword = 'Ravva@1234';
  const testName = 'Test Employee 2026';
  const email = `${testUsername}@vkit.local`;

  console.log(`1. Creating employee "${testUsername}" (${email}) with password "${testPassword}" via Supabase Native Auth...`);

  const { data: authData, error: authErr } = await client.auth.signUp({
    email,
    password: testPassword,
    options: {
      data: {
        full_name: testName,
        username: testUsername,
        role: 'employee'
      }
    }
  });

  if (authErr) {
    console.error('❌ Native Auth Creation Failed:', authErr.message);
    process.exit(1);
  }

  const userId = authData.user.id;
  console.log(`✅ Auth user created natively! User ID: ${userId}`);

  // Insert profile in public.profiles table
  const { error: profErr } = await client.from('profiles').upsert({
    id: userId,
    full_name: testName,
    username: testUsername,
    role: 'employee',
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  });

  if (profErr) {
    console.error('Profile upsert error:', profErr.message);
  } else {
    console.log('✅ Profile inserted into public.profiles table!');
  }

  // Sign out
  await client.auth.signOut();

  // Test sign in for 'testuser2026'
  console.log(`\n2. Testing employee sign-in for username "${testUsername}" with password "${testPassword}"...`);
  const { data: loginData, error: loginErr } = await client.auth.signInWithPassword({
    email,
    password: testPassword
  });

  if (loginErr) {
    console.error(`❌ Login failed:`, loginErr.message);
  } else {
    console.log(`🎉🎉🎉 SUCCESS! Employee "${testUsername}" logged in successfully! User ID: ${loginData.user.id}`);
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
