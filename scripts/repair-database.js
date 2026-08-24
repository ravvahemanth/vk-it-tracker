import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

const supabaseAnon = createClient(supabaseUrl, supabaseAnonKey);

async function repairUserAndTestLogin() {
  console.log('--- REPAIR & TEST LOGIN SCRIPT ---');
  
  // 1. Delete broken test1 user profile & auth user completely so it can be re-created cleanly
  console.log('Checking for test1 in profiles...');
  const { data: prof } = await supabaseAdmin
    .from('profiles')
    .select('id')
    .eq('username', 'test1')
    .maybeSingle();

  if (prof) {
    console.log('Deleting profile test1 (id:', prof.id, ')...');
    await supabaseAdmin.from('profiles').delete().eq('id', prof.id);
  }

  // 2. Re-create user 'test1' using official Supabase Admin API
  const email = 'test1@vkit.local';
  const password = 'ravva@222';
  const fullName = 'Test User 1';

  console.log(`Re-creating user '${email}' via Supabase Auth Admin API...`);

  // Check if exists in auth list first
  const { data: listData } = await supabaseAdmin.auth.admin.listUsers().catch(() => ({ data: { users: [] } }));
  const existingUser = listData?.users?.find(u => u.email === email);

  if (existingUser) {
    console.log('Found existing auth user, deleting first (id:', existingUser.id, ')...');
    await supabaseAdmin.auth.admin.deleteUser(existingUser.id);
  }

  const { data: authUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      full_name: fullName,
      username: 'test1',
      role: 'employee'
    }
  });

  if (createError) {
    console.error('❌ Failed to create user:', createError.message);
    return;
  }

  console.log('✅ User created cleanly in Auth! User ID:', authUser.user.id);

  // 3. Upsert into public.profiles
  const { data: newProf, error: profErr } = await supabaseAdmin
    .from('profiles')
    .upsert({
      id: authUser.user.id,
      full_name: fullName,
      username: 'test1',
      role: 'employee',
      is_active: true
    })
    .select()
    .single();

  if (profErr) {
    console.error('❌ Failed to create profile:', profErr.message);
    return;
  }

  console.log('✅ Profile created cleanly:', newProf);

  // 4. Test login with test1 / ravva@222
  console.log('\nTesting Login with test1@vkit.local / ravva@222...');
  const { data: loginSession, error: loginError } = await supabaseAnon.auth.signInWithPassword({
    email: 'test1@vkit.local',
    password: 'ravva@222'
  });

  if (loginError) {
    console.error('❌ Login failed:', loginError.message);
  } else {
    console.log('🎉 LOGIN SUCCESSFUL! User ID:', loginSession.user.id);
  }
}

repairUserAndTestLogin();
