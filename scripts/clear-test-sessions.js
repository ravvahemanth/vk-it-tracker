import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const serviceClient = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function clearSessions() {
  console.log('Clearing all work session data for clean production launch...');
  
  const { data: before, error: countErr } = await serviceClient
    .from('work_sessions')
    .select('id');
    
  console.log(`Current session count: ${before?.length || 0}`);
  
  const { error: delErr } = await serviceClient
    .from('work_sessions')
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000'); // delete all rows
    
  if (delErr) {
    console.error('Error clearing sessions:', delErr.message);
  } else {
    console.log('✅ All work sessions cleared successfully!');
  }
  
  const { data: profiles } = await serviceClient
    .from('profiles')
    .select('id, full_name, username, role, is_active')
    .order('full_name');
    
  console.log(`\nActive Employee Profiles preserved (${profiles?.length || 0}):`);
  profiles?.forEach(p => console.log(`  - [${p.role}] @${p.username} (${p.full_name})`));
}

clearSessions().catch(console.error);
