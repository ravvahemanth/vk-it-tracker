/**
 * check-and-fix-rls.js
 * Checks current RLS policies and verifies whether migration 007 needs to be applied.
 * Also tests whether the admin can query profiles via the anon client.
 * 
 * Run: node scripts/check-and-fix-rls.js
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
  console.log('=== RLS Policy Check + Migration 007 Status ===\n');

  // 1. Create service role client to check current policies
  const serviceClient = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });

  // 2. Check what policies currently exist on profiles table
  console.log('📋 Checking current RLS policies on profiles table...');
  const { data: policies, error: polErr } = await serviceClient
    .rpc('get_policies_info') // This may not exist
    .catch(() => ({ data: null, error: { message: 'RPC not available' } }));

  // 3. Sign in as admin and test profile read via authenticated client
  const anonClient = createClient(supabaseUrl, anonKey);
  
  console.log('\n🔑 Signing in as admin...');
  const { data: authData, error: authError } = await anonClient.auth.signInWithPassword({
    email: adminEmail,
    password: adminPassword,
  });

  if (authError) {
    console.error('❌ Admin login failed:', authError.message);
    process.exit(1);
  }
  console.log('✅ Admin authenticated:', authData.user.email);

  // 4. Test profile query as admin via anon client (should work if RLS is correct)
  console.log('\n📊 Testing profiles query as authenticated admin (anon client)...');
  const { data: profilesAnon, error: profAnonErr } = await anonClient
    .from('profiles')
    .select('id, full_name, username, role')
    .eq('role', 'employee')
    .order('full_name');

  if (profAnonErr) {
    console.log('❌ profiles query via anon+admin session FAILED:', profAnonErr.message);
    console.log('   Code:', profAnonErr.code);
    console.log('   → This means RLS policies are blocking admin reads (likely infinite recursion)');
    console.log('   → Migration 007 needs to be applied to fix RLS!');
  } else {
    console.log(`✅ profiles query via anon+admin session SUCCEEDED: ${profilesAnon?.length} employees`);
    profilesAnon?.slice(0, 3).forEach(p => console.log(`   - ${p.full_name} (@${p.username})`));
  }

  // 5. Test via service role client (always bypasses RLS)
  console.log('\n🔧 Testing profiles query via service role client (bypasses RLS)...');
  const { data: profilesService, error: profServiceErr } = await serviceClient
    .from('profiles')
    .select('id, full_name, username, role')
    .eq('role', 'employee')
    .order('full_name');

  if (profServiceErr) {
    console.log('❌ Service role query FAILED:', profServiceErr.message);
  } else {
    console.log(`✅ Service role query SUCCEEDED: ${profilesService?.length} employees`);
  }

  // 6. Test get_admin_daily_summary RPC
  console.log('\n⚡ Testing get_admin_daily_summary RPC...');
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
  const { data: rpcData, error: rpcErr } = await anonClient
    .rpc('get_admin_daily_summary', { p_date: today });

  if (rpcErr) {
    console.log('❌ RPC FAILED:', rpcErr.message);
    console.log('   → This is the known bug: function max(json) does not exist');
    console.log('   → Need to apply migration 007 to fix this RPC');
  } else {
    console.log('✅ RPC SUCCEEDED:', JSON.stringify(rpcData)?.substring(0, 100));
  }

  // 7. Determine what needs to be done
  console.log('\n=== DIAGNOSIS SUMMARY ===');
  if (profAnonErr) {
    console.log('🚨 CRITICAL: Migration 007 has NOT been applied to the database');
    console.log('   The current RLS policies have infinite recursion issues.');
    console.log('\n👉 ACTION REQUIRED: Apply migration 007 manually via Supabase SQL Editor:');
    console.log('   URL: https://supabase.com/dashboard/project/qzcggsqfsocniolsdaph/sql/new');
    console.log('   Copy and paste the contents of: supabase/migrations/007_fix_recursion_and_summary_rpc.sql');
  } else if (rpcErr) {
    console.log('⚠️  PARTIAL: RLS policies are OK but the RPC function is still broken');
    console.log('   The JS fallback in api.js will handle this automatically.');
    console.log('\n👉 OPTIONAL: Apply migration 007 to also fix the RPC for better performance');
  } else {
    console.log('✅ ALL GOOD: Both RLS and RPC are working correctly!');
  }

  console.log('\n=== END ===');
  process.exit(0);
}

main().catch(err => {
  console.error('Script error:', err);
  process.exit(1);
});
