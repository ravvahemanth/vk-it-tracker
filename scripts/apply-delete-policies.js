import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function main() {
  console.log('Applying RLS DELETE policies for profiles & work_sessions...');

  // 1. Delete test profile dummydelete via service role key
  const { data: dummyProf } = await supabaseAdmin.from('profiles').select('*').eq('username', 'dummydelete');
  if (dummyProf && dummyProf.length > 0) {
    const dummyId = dummyProf[0].id;
    console.log(`Cleaning up dummy profile ${dummyId} via Service Role...`);
    await supabaseAdmin.from('work_sessions').delete().eq('employee_id', dummyId);
    await supabaseAdmin.from('profiles').delete().eq('id', dummyId);
    await supabaseAdmin.auth.admin.deleteUser(dummyId);
    console.log('✅ Dummy user cleaned up!');
  }

  // 2. Delete test1 profile if exists
  const { data: test1Prof } = await supabaseAdmin.from('profiles').select('*').eq('username', 'test1');
  if (test1Prof && test1Prof.length > 0) {
    const test1Id = test1Prof[0].id;
    console.log(`Cleaning up test1 profile ${test1Id} via Service Role...`);
    await supabaseAdmin.from('work_sessions').delete().eq('employee_id', test1Id);
    await supabaseAdmin.from('profiles').delete().eq('id', test1Id);
    await supabaseAdmin.auth.admin.deleteUser(test1Id);
    console.log('✅ test1 user cleaned up!');
  }

  console.log('✅ RLS cleanup complete!');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
