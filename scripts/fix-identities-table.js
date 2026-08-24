import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function main() {
  console.log('Fixing test1 user auth identities & password...');

  const userId = 'b992fcbc-c86f-4312-84b6-5475d3bb8956';
  const newPass = 'Ravva@1234';
  const email = 'test1@vkit.local';

  // 1. Delete user from auth.users via admin API
  console.log(`Deleting corrupted auth user ${userId}...`);
  const { error: delErr } = await supabaseAdmin.auth.admin.deleteUser(userId);
  console.log('Delete user result:', delErr ? delErr.message : 'Successfully deleted auth user!');

  // Also delete profile row
  const { error: profDelErr } = await supabaseAdmin.from('profiles').delete().eq('id', userId);
  console.log('Profile delete result:', profDelErr ? profDelErr.message : 'Successfully deleted profile row!');

  // 2. Re-create user fresh via admin API
  console.log(`\nRe-creating employee user "${email}" with password "${newPass}" via Supabase Admin API...`);
  const { data: createData, error: createErr } = await supabaseAdmin.auth.admin.createUser({
    email: email,
    password: newPass,
    email_confirm: true,
    user_metadata: { full_name: 'Test 1 Employee', username: 'test1', role: 'employee' }
  });

  if (createErr) {
    console.error('❌ Error creating user via Admin API:', createErr.message);
    process.exit(1);
  }

  const newUserId = createData.user.id;
  console.log(`🎉 User created successfully! New User ID: ${newUserId}`);

  // Upsert profile row
  const { error: profUpsertErr } = await supabaseAdmin.from('profiles').upsert({
    id: newUserId,
    full_name: 'Test 1 Employee',
    username: 'test1',
    role: 'employee',
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  });

  if (profUpsertErr) {
    console.error('Profile upsert error:', profUpsertErr.message);
  } else {
    console.log('✅ Profile inserted successfully into public.profiles!');
  }

  // 3. Test Sign-in with Anon Client
  console.log('\nTesting employee sign-in via Anon client...');
  const client = createClient(supabaseUrl, supabaseAnonKey);
  const { data: loginData, error: loginErr } = await client.auth.signInWithPassword({
    email: email,
    password: newPass
  });

  if (loginErr) {
    console.error('❌ Sign-in failed:', loginErr.message);
  } else {
    console.log(`🎉 SUCCESS! Employee logged in successfully! User ID: ${loginData.user.id}`);
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
