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
    console.error('❌ Admin login failed:', adminErr.message);
    process.exit(1);
  }
  console.log('✅ Admin authenticated!');

  // Check profile for dummydelete
  const { data: profiles } = await client.from('profiles').select('*').eq('username', 'dummydelete');
  const dummy = profiles?.[0];

  if (dummy) {
    console.log(`Found dummy employee (ID: ${dummy.id}). Deleting...`);
    const { error: sessErr } = await client.from('work_sessions').delete().eq('employee_id', dummy.id);
    const { error: profErr } = await client.from('profiles').delete().eq('id', dummy.id);
    console.log('Delete result:', profErr ? profErr.message : 'SUCCESS!');
  } else {
    console.log('No dummy employee found.');
  }

  // Verify profile is deleted
  const { data: checkProfile } = await client.from('profiles').select('*').eq('username', 'dummydelete');
  if (!checkProfile || checkProfile.length === 0) {
    console.log('🎉🎉🎉 SUCCESS! Employee profile permanently deleted!');
  } else {
    console.error('❌ FAIL: Profile still exists!');
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
