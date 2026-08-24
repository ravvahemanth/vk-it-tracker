import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

const anonClient = createClient(supabaseUrl, supabaseAnonKey);

async function testBrowserLikeQuery() {
  console.log('--- TESTING BROWSER-LIKE QUERY (ANON KEY ONLY) ---');
  
  // Login as admin@vkit.local
  const { data: authData, error: authErr } = await anonClient.auth.signInWithPassword({
    email: 'admin@vkit.local',
    password: 'Krrish@@1999'
  });
  
  if (authErr) {
    console.error('Login error:', authErr.message);
    return;
  }
  
  console.log('✅ Admin logged in. Auth UID:', authData.user.id);
  
  // 1. Query own profile
  const { data: myProfile, error: myProfErr } = await anonClient
    .from('profiles')
    .select('*')
    .eq('id', authData.user.id)
    .single();
  console.log('1. Own profile query:', myProfErr ? `❌ ${myProfErr.message}` : `✅ Success: role=${myProfile?.role}`);

  // 2. Query all profiles (for employee list)
  const { data: allProfiles, error: allProfErr } = await anonClient
    .from('profiles')
    .select('*')
    .eq('role', 'employee');
  console.log('2. All profiles query:', allProfErr ? `❌ ${allProfErr.message}` : `✅ Success: ${allProfiles?.length} employees found`);

  // 3. Query work_sessions
  const { data: sessions, error: sessErr } = await anonClient
    .from('work_sessions')
    .select('*');
  console.log('3. Work sessions query:', sessErr ? `❌ ${sessErr.message}` : `✅ Success: ${sessions?.length} sessions found`);
}

testBrowserLikeQuery().catch(console.error);
