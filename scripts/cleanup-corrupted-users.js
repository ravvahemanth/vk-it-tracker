import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function cleanup() {
  console.log('Cleaning up corrupted rows from auth.users and public.profiles...');

  // Delete test profile rows
  const { data: deletedProfiles, error: pErr } = await supabaseAdmin
    .from('profiles')
    .delete()
    .or('username.eq.test1,username.eq.test 1,full_name.ilike.%test%')
    .select();

  console.log('Deleted test profiles:', deletedProfiles, pErr);

  console.log('Testing Admin login again...');
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY;
  const anonClient = createClient(supabaseUrl, anonKey);
  const { data: adminLogin, error: adminErr } = await anonClient.auth.signInWithPassword({
    email: 'admin@vkit.local',
    password: 'Krrish@@1999'
  });

  if (adminErr) {
    console.error('❌ Admin login failed:', adminErr.message);
  } else {
    console.log('✅ Admin login SUCCESS! User ID:', adminLogin.user.id);
  }

  console.log('Testing Manoj login again...');
  const { data: manojLogin, error: manojErr } = await anonClient.auth.signInWithPassword({
    email: 'manoj@vkit.local',
    password: 'VKIt@Manoj2026!'
  });

  if (manojErr) {
    console.error('❌ Manoj login failed:', manojErr.message);
  } else {
    console.log('✅ Manoj login SUCCESS! User ID:', manojLogin.user.id);
  }
}

cleanup();
