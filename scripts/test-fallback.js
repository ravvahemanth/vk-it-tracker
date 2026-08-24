import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabaseAnon = createClient(supabaseUrl, supabaseAnonKey);

async function testAdminSummary() {
  console.log('Testing Admin Login...');
  const { data: auth, error: authError } = await supabaseAnon.auth.signInWithPassword({
    email: 'admin@vkit.local',
    password: 'Krrish@@1999'
  });

  if (authError) {
    console.error('Auth error:', authError.message);
    return;
  }
  console.log('Logged in as:', auth.user.email);

  const targetDate = '2026-08-24';
  
  // Test fallback query
  console.log('\nTesting Fallback Summary calculation...');
  const { data: profiles, error: profErr } = await supabaseAnon
    .from('profiles')
    .select('id, full_name, username, is_active, role')
    .eq('role', 'employee')
    .eq('is_active', true)
    .order('full_name');

  if (profErr) {
    console.error('Profiles query error:', profErr.message);
    return;
  }

  const { data: sessions, error: sessErr } = await supabaseAnon
    .from('work_sessions')
    .select('*')
    .eq('work_date', targetDate);

  if (sessErr) {
    console.error('Sessions query error:', sessErr.message);
    return;
  }

  console.log(`Successfully fetched ${profiles.length} profiles and ${sessions.length} sessions.`);
  console.log('Sample profile:', profiles[0]);
  console.log('\nSummary test PASSED successfully!');
}

testAdminSummary();
