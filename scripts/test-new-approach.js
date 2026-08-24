/**
 * Test the new adminCreateEmployee / adminDeleteEmployee approach
 * using GoTrue Admin API (no SQL inserts needed for auth.users)
 */
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

const adminSupabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});
const anonClient = createClient(supabaseUrl, supabaseAnonKey);

async function testNewApproach() {
  console.log('\n=== TESTING NEW GOTRUE ADMIN API APPROACH ===\n');

  const testUsername = 'newtest001';
  const testPassword = 'NewTest@001!';
  const testEmail = `${testUsername}@vkit.local`;

  // Clean up any leftover
  const { data: existProf } = await adminSupabase.from('profiles').select('id').eq('username', testUsername).maybeSingle();
  if (existProf) {
    await adminSupabase.from('work_sessions').delete().eq('employee_id', existProf.id);
    await adminSupabase.from('profiles').delete().eq('id', existProf.id);
    await adminSupabase.auth.admin.deleteUser(existProf.id);
    console.log('Pre-cleaned leftover account');
  }

  // STEP 1: Create via GoTrue Admin API
  console.log('Step 1: Creating user via GoTrue Admin API...');
  const { data: created, error: createErr } = await adminSupabase.auth.admin.createUser({
    email: testEmail,
    password: testPassword,
    email_confirm: true,
    user_metadata: {
      full_name: 'New Test 001',
      username: testUsername,
      role: 'employee',
    }
  });

  if (createErr) {
    console.error('❌ Creation FAILED:', createErr.message);
    return;
  }
  console.log('✅ Auth user created:', created.user.id);

  // STEP 2: Upsert profile (simulate what frontend does)
  const { data: profile, error: profErr } = await adminSupabase.from('profiles').upsert({
    id: created.user.id,
    full_name: 'New Test 001',
    username: testUsername,
    role: 'employee',
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }, { onConflict: 'id' }).select().single();

  if (profErr) {
    console.warn('Profile upsert notice:', profErr.message);
  } else {
    console.log('✅ Profile upserted:', profile.username, profile.role);
  }

  // STEP 3: Test login
  console.log('Step 3: Testing login...');
  const loginClient = createClient(supabaseUrl, supabaseAnonKey);
  const { data: loginData, error: loginErr } = await loginClient.auth.signInWithPassword({
    email: testEmail,
    password: testPassword
  });

  if (loginErr) {
    console.error('❌ Login FAILED:', loginErr.message);
  } else {
    console.log('✅ Login SUCCESS! User ID:', loginData.user.id);

    // STEP 4: Verify profile accessible via RLS
    const { data: myProfile } = await loginClient.from('profiles').select('*').eq('id', loginData.user.id).single();
    console.log('✅ Profile via RLS:', myProfile?.username, myProfile?.role, myProfile?.is_active ? 'active' : 'INACTIVE');

    // STEP 5: Test start work session
    const { data: sessionData } = await loginClient.rpc('start_work_session', { p_starting_form: 7000 });
    if (sessionData?.success) {
      console.log('✅ Work session started:', sessionData.session.id);
      const { data: endData } = await loginClient.rpc('complete_work_session', {
        p_session_id: sessionData.session.id,
        p_ending_form: 7050
      });
      if (endData?.success) {
        console.log('✅ Work session completed: 7000→7050 =', endData.total_forms, 'forms');
      } else {
        console.error('❌ Complete session failed:', endData?.error);
      }
    } else {
      console.error('❌ Start session failed:', sessionData?.error);
    }

    await loginClient.auth.signOut();
  }

  // STEP 6: Test password reset
  console.log('\nStep 6: Testing password reset...');
  const { error: resetErr } = await adminSupabase.auth.admin.updateUserById(
    created.user.id,
    { password: 'ResetTest@999!' }
  );

  if (resetErr) {
    console.error('❌ Password reset FAILED:', resetErr.message);
  } else {
    const loginClient2 = createClient(supabaseUrl, supabaseAnonKey);
    const { data: resetLoginData, error: resetLoginErr } = await loginClient2.auth.signInWithPassword({
      email: testEmail,
      password: 'ResetTest@999!'
    });
    if (resetLoginErr) {
      console.error('❌ Post-reset login FAILED:', resetLoginErr.message);
    } else {
      console.log('✅ Password reset works! New password accepted.');
      await loginClient2.auth.signOut();
    }
  }

  // STEP 7: Test delete
  console.log('\nStep 7: Testing delete...');
  await adminSupabase.from('work_sessions').delete().eq('employee_id', created.user.id);
  await adminSupabase.from('profiles').delete().eq('id', created.user.id);
  const { error: deleteErr } = await adminSupabase.auth.admin.deleteUser(created.user.id);

  if (deleteErr) {
    console.error('❌ Delete auth user FAILED:', deleteErr.message);
  } else {
    // Verify user can't login
    const verifyClient = createClient(supabaseUrl, supabaseAnonKey);
    const { error: verifyErr } = await verifyClient.auth.signInWithPassword({
      email: testEmail,
      password: 'ResetTest@999!'
    });
    if (verifyErr) {
      console.log('✅ Delete confirmed — login no longer works:', verifyErr.message);
    } else {
      console.error('❌ Deleted user can still log in!');
    }
  }

  console.log('\n=== TEST COMPLETE ===\n');
}

testNewApproach().catch(console.error);
