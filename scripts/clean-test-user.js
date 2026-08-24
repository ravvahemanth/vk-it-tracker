import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function cleanTestUser() {
  console.log('Finding test1 profile in public.profiles...');
  const { data: prof, error: profErr } = await supabaseAdmin
    .from('profiles')
    .select('*')
    .eq('username', 'test1')
    .maybeSingle();

  if (profErr) {
    console.error('Profile error:', profErr);
    return;
  }

  if (prof) {
    console.log('Found profile for test1:', prof.id);
    console.log('Attempting to delete user via auth.admin.deleteUser(', prof.id, ')...');
    const { error: delErr } = await supabaseAdmin.auth.admin.deleteUser(prof.id);
    if (delErr) {
      console.error('Delete user error:', delErr.message);
    } else {
      console.log('Successfully deleted test1 user from Auth!');
    }
  } else {
    console.log('No profile found for test1.');
  }
}

cleanTestUser();
