import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const client = createClient(supabaseUrl, supabaseAnonKey);
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function main() {
  const email = 'test1@vkit.local';
  const password = 'Ravva@1234';
  const username = 'test1';
  const fullName = 'Test 1 Employee';

  console.log(`1. Creating account for "${username}" (${email}) with password "${password}"...`);

  // Sign up natively
  const { data: signUpData, error: signUpErr } = await client.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: fullName,
        username: username,
        role: 'employee'
      }
    }
  });

  if (signUpErr) {
    console.error('SignUp Error:', signUpErr.message);
    process.exit(1);
  }

  const userId = signUpData.user.id;
  console.log(`✅ Auth user created natively! User ID: ${userId}`);

  // Confirm email via admin
  console.log('Confirming user email via admin API...');
  await supabaseAdmin.auth.admin.updateUserById(userId, { email_confirm: true });

  // Insert Profile in public.profiles
  console.log('Upserting profile in public.profiles table...');
  const { error: pErr } = await supabaseAdmin.from('profiles').upsert({
    id: userId,
    full_name: fullName,
    username: username,
    role: 'employee',
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  });

  if (pErr) console.error('Profile upsert error:', pErr.message);
  else console.log('✅ Profile upserted successfully!');

  // Test Login with test1 & Ravva@1234
  console.log('\n2. Testing live sign-in for "test1" with password "Ravva@1234"...');
  const { data: loginData, error: loginErr } = await client.auth.signInWithPassword({
    email,
    password
  });

  if (loginErr) {
    console.error('❌ LOGIN FAILED:', loginErr.message);
  } else {
    console.log(`🎉 SUCCESS! Employee logged in successfully! User ID: ${loginData.user.id}`);
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
