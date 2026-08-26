/**
 * diagnose-rls.js
 * Diagnoses RLS policy issues. Tests admin profile reads via anon client.
 * Run: node scripts/diagnose-rls.js
 */
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const anonKey = process.env.VITE_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;
const adminEmail = process.env.ADMIN_EMAIL || 'admin@vkit.local';
const adminPassword = process.env.ADMIN_PASSWORD || 'Krrish@@1999';

async function main() {
  console.log('=== RLS DIAGNOSIS ===\n');
  console.log('URL:', supabaseUrl);
  console.log('Anon Key set:', !!anonKey);
  console.log('Service Key set:', !!serviceKey);

  const serviceClient = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });

  const anonClient = createClient(supabaseUrl, anonKey);

  // 1. Login as admin
  console.log('\n1. Logging in as admin...');
  const { data: authData, error: authErr } = await anonClient.auth.signInWithPassword({
    email: adminEmail, password: adminPassword
  });
  if (authErr) { console.error('LOGIN FAILED:', authErr.message); process.exit(1); }
  console.log('✅ Login OK, user:', authData.user.email, 'uid:', authData.user.id);

  // 2. Check admin's own profile
  console.log('\n2. Reading admin profile (anon client)...');
  const { data: ownProfile, error: ownErr } = await anonClient
    .from('profiles').select('*').eq('id', authData.user.id).maybeSingle();
  if (ownErr) console.log('❌ Own profile failed:', ownErr.code, ownErr.message);
  else console.log('✅ Own profile OK:', ownProfile?.username, ownProfile?.role);

  // 3. Try reading ALL profiles as admin
  console.log('\n3. Reading ALL profiles as admin (anon client + admin session)...');
  const { data: allProfiles, error: allErr } = await anonClient
    .from('profiles').select('id, full_name, role').order('full_name');
  if (allErr) {
    console.log('❌ ALL profiles FAILED:', allErr.code, allErr.message);
    console.log('   Full error:', JSON.stringify(allErr));
  } else {
    console.log(`✅ ALL profiles OK: got ${allProfiles?.length} rows`);
  }

  // 4. Try reading employee profiles only
  console.log('\n4. Reading employee profiles only (anon client + admin session)...');
  const { data: empProfiles, error: empErr } = await anonClient
    .from('profiles').select('id, full_name, role').eq('role', 'employee');
  if (empErr) {
    console.log('❌ Employee profiles FAILED:', empErr.code, empErr.message);
  } else {
    console.log(`✅ Employee profiles OK: got ${empProfiles?.length} rows`);
  }

  // 5. Try via service role client
  console.log('\n5. Reading profiles via service role (bypasses RLS)...');
  const { data: srProfiles, error: srErr } = await serviceClient
    .from('profiles').select('id, full_name, role').eq('role', 'employee');
  if (srErr) console.log('❌ Service role profiles FAILED:', srErr.message);
  else console.log(`✅ Service role profiles OK: got ${srProfiles?.length} rows`);

  // 6. Test get_my_role() function
  console.log('\n6. Testing get_my_role() RPC...');
  const { data: roleData, error: roleErr } = await anonClient.rpc('get_my_role');
  if (roleErr) console.log('❌ get_my_role FAILED:', roleErr.message);
  else console.log('✅ get_my_role OK:', roleData);

  // 7. Test get_admin_daily_summary RPC
  console.log('\n7. Testing get_admin_daily_summary RPC...');
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
  const { data: rpcData, error: rpcErr } = await anonClient
    .rpc('get_admin_daily_summary', { p_date: today });
  if (rpcErr) console.log('❌ get_admin_daily_summary FAILED:', rpcErr.message);
  else console.log('✅ get_admin_daily_summary OK');

  // 8. Test work_sessions query
  console.log('\n8. Testing work_sessions query (admin)...');
  const { data: sessions, error: sessErr } = await anonClient
    .from('work_sessions').select('id, employee_id, status').eq('work_date', today);
  if (sessErr) console.log('❌ work_sessions FAILED:', sessErr.code, sessErr.message);
  else console.log(`✅ work_sessions OK: ${sessions?.length} sessions today`);

  console.log('\n=== SUMMARY ===');
  const issues = [];
  if (ownErr) issues.push('- Admin cannot read own profile');
  if (allErr) issues.push('- Admin cannot read all profiles (RLS blocking)');
  if (roleErr) issues.push('- get_my_role() RPC broken');
  if (rpcErr) issues.push(`- get_admin_daily_summary RPC broken: ${rpcErr.message}`);
  if (sessErr) issues.push('- work_sessions query blocked');

  if (issues.length === 0) {
    console.log('✅ All queries working. No RLS issues found.');
  } else {
    console.log('❌ Issues found:');
    issues.forEach(i => console.log(i));
    if (allErr) {
      console.log('\n🚨 FIX REQUIRED: Apply migration 007 in Supabase SQL Editor:');
      console.log('   https://supabase.com/dashboard/project/qzcggsqfsocniolsdaph/sql/new');
    }
  }
}

main().catch(err => { console.error('Fatal:', err.message); process.exit(1); });
