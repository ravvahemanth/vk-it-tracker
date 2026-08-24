import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

const client = createClient(supabaseUrl, supabaseAnonKey);

async function testSummary() {
  console.log('Logging in as admin@vkit.local...');
  const { data: authData, error: authErr } = await client.auth.signInWithPassword({
    email: 'admin@vkit.local',
    password: 'Krrish@@1999'
  });
  
  if (authErr) {
    console.error('Auth error:', authErr.message);
    return;
  }
  console.log('Logged in as:', authData.user.id);
  
  const today = '2026-08-24';
  
  console.log('\n--- Test RPC get_admin_daily_summary ---');
  const { data: rpcData, error: rpcErr } = await client.rpc('get_admin_daily_summary', { p_date: today });
  console.log('RPC error:', rpcErr);
  console.log('RPC data:', JSON.stringify(rpcData, null, 2));
  
  console.log('\n--- Test fallback queries ---');
  const { data: profiles, error: profErr } = await client
    .from('profiles')
    .select('id, full_name, username, is_active, role')
    .eq('role', 'employee')
    .order('full_name');
  console.log('Profiles error:', profErr);
  console.log('Profiles count:', profiles?.length);

  const { data: sessions, error: sessErr } = await client
    .from('work_sessions')
    .select('*')
    .eq('work_date', today);
  console.log('Sessions error:', sessErr);
  console.log('Sessions count:', sessions?.length);
}

testSummary().catch(console.error);
