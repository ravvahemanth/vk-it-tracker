import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceKey) {
  console.error('❌ Missing environment configuration');
  process.exit(1);
}

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

const testReport = {
  passed: [],
  failed: [],
  bugsFixed: [
    'Fixed PostgreSQL MAX(json) error in get_admin_daily_summary SQL RPC by converting to (MAX(jsonb_build_object(...)))::json',
    'Added JS fallback in getAdminDailySummary for direct database rendering resilience',
    'Fixed auth.identities insertion in admin_create_employee SQL RPC (provider_id = v_email instead of v_new_id::text) resolving "Database error querying schema"',
    'Updated vite.config.js with host: true enabling mobile local network testing'
  ]
};

function recordTest(name, status, details = '') {
  if (status === 'PASS') {
    testReport.passed.push({ name, details });
    console.log(`  ✅ PASS: ${name} ${details ? `(${details})` : ''}`);
  } else {
    testReport.failed.push({ name, error: details });
    console.log(`  ❌ FAIL: ${name} — ${details}`);
  }
}

async function runE2ESuite() {
  console.log('================================================================');
  console.log('    VK IT SOLUTIONS TRACKER — END-TO-END AUTOMATED TEST SUITE   ');
  console.log('================================================================\n');

  // ----------------------------------------------------------------
  // 1. SUPABASE CONNECTION & ENVIRONMENT TESTS
  // ----------------------------------------------------------------
  console.log('--- 1. ENVIRONMENT & CONNECTION TESTS ---');
  try {
    const res = await fetch(`${supabaseUrl}/rest/v1/`, {
      headers: { 'apikey': supabaseAnonKey, 'Authorization': `Bearer ${supabaseAnonKey}` }
    });
    if (res.status < 500) {
      recordTest('1. Supabase REST API Reachability', 'PASS', `Status: ${res.status}`);
    } else {
      recordTest('1. Supabase REST API Reachability', 'FAIL', `Status: ${res.status}`);
    }
  } catch (err) {
    recordTest('1. Supabase REST API Reachability', 'FAIL', err.message);
  }

  // ----------------------------------------------------------------
  // 2. AUTHENTICATION TESTS
  // ----------------------------------------------------------------
  console.log('\n--- 2. AUTHENTICATION TESTS ---');
  
  // Test A: Admin Login
  let adminClient = createClient(supabaseUrl, supabaseAnonKey);
  try {
    const { data, error } = await adminClient.auth.signInWithPassword({
      email: 'admin@vkit.local',
      password: 'Krrish@@1999'
    });
    if (!error && data?.user) {
      recordTest('2A. Admin Login', 'PASS', `User: ${data.user.email}`);
    } else {
      recordTest('2A. Admin Login', 'FAIL', error?.message);
    }
  } catch (err) {
    recordTest('2A. Admin Login', 'FAIL', err.message);
  }

  // Test B: Invalid Password
  try {
    const client = createClient(supabaseUrl, supabaseAnonKey);
    const { data, error } = await client.auth.signInWithPassword({
      email: 'admin@vkit.local',
      password: 'WrongPassword999'
    });
    if (error) {
      recordTest('2B. Invalid Password Rejection', 'PASS', 'Correctly rejected invalid credentials');
    } else {
      recordTest('2B. Invalid Password Rejection', 'FAIL', 'Unexpected login success with wrong password');
    }
  } catch (err) {
    recordTest('2B. Invalid Password Rejection', 'PASS', err.message);
  }

  // Test C: Invalid Username
  try {
    const client = createClient(supabaseUrl, supabaseAnonKey);
    const { data, error } = await client.auth.signInWithPassword({
      email: 'nonexistentuser999@vkit.local',
      password: 'SomePassword123'
    });
    if (error) {
      recordTest('2C. Non-existent User Rejection', 'PASS', 'Correctly rejected non-existent user');
    } else {
      recordTest('2C. Non-existent User Rejection', 'FAIL', 'Unexpected login success for non-existent user');
    }
  } catch (err) {
    recordTest('2C. Non-existent User Rejection', 'PASS', err.message);
  }

  // ----------------------------------------------------------------
  // 3. EMPLOYEE CREATION & VALIDATION TESTS
  // ----------------------------------------------------------------
  console.log('\n--- 3. EMPLOYEE CREATION & VALIDATION TESTS ---');
  const testUsername = 'ramesh';
  const testEmail = `${testUsername}@vkit.local`;
  const testPassword = 'RameshTest123!';
  const testFullName = 'Ramesh Kumar';

  // Clean up any existing Ramesh account for reproducible test run
  try {
    const { data: existingProfiles } = await supabaseAdmin.from('profiles').select('id').eq('username', testUsername);
    if (existingProfiles && existingProfiles.length > 0) {
      for (const p of existingProfiles) {
        await supabaseAdmin.from('work_sessions').delete().eq('employee_id', p.id);
        await supabaseAdmin.from('profiles').delete().eq('id', p.id);
        await supabaseAdmin.auth.admin.deleteUser(p.id).catch(() => {});
      }
    }
  } catch (err) {}

  // Test 3A: Create Ramesh Employee Account
  let rameshUserId = null;
  try {
    const { data: authUser, error: authErr } = await supabaseAdmin.auth.admin.createUser({
      email: testEmail,
      password: testPassword,
      email_confirm: true,
      user_metadata: { full_name: testFullName, username: testUsername, role: 'employee' }
    });

    if (authErr) {
      recordTest('3A. Employee Creation (Ramesh Kumar)', 'FAIL', authErr.message);
    } else {
      rameshUserId = authUser.user.id;
      const { error: profErr } = await supabaseAdmin.from('profiles').upsert({
        id: rameshUserId,
        full_name: testFullName,
        username: testUsername,
        role: 'employee',
        is_active: true
      });
      if (profErr) {
        recordTest('3A. Employee Creation (Ramesh Kumar)', 'FAIL', profErr.message);
      } else {
        recordTest('3A. Employee Creation (Ramesh Kumar)', 'PASS', `ID: ${rameshUserId}`);
      }
    }
  } catch (err) {
    recordTest('3A. Employee Creation (Ramesh Kumar)', 'FAIL', err.message);
  }

  // Test 3B: Duplicate Username Rejection
  try {
    const { data: authUser, error } = await supabaseAdmin.auth.admin.createUser({
      email: testEmail,
      password: testPassword,
      email_confirm: true,
    });
    if (error) {
      recordTest('3B. Duplicate Username Protection', 'PASS', 'Duplicate username/email rejected');
    } else {
      recordTest('3B. Duplicate Username Protection', 'FAIL', 'Duplicate account was created!');
    }
  } catch (err) {
    recordTest('3B. Duplicate Username Protection', 'PASS', err.message);
  }

  // Test 3C: Employee Login After Creation
  let rameshClient = createClient(supabaseUrl, supabaseAnonKey);
  try {
    const { data, error } = await rameshClient.auth.signInWithPassword({
      email: testEmail,
      password: testPassword
    });
    if (!error && data?.user) {
      recordTest('3C. Employee Login After Creation', 'PASS', `Logged in as ${data.user.email}`);
    } else {
      recordTest('3C. Employee Login After Creation', 'FAIL', error?.message);
    }
  } catch (err) {
    recordTest('3C. Employee Login After Creation', 'FAIL', err.message);
  }

  // ----------------------------------------------------------------
  // 4. WORK SESSIONS & FORM CALCULATION TESTS
  // ----------------------------------------------------------------
  console.log('\n--- 4. WORK SESSIONS & FORM CALCULATION TESTS ---');
  const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });

  // Test 4A: Start Session 1 at 1000
  let session1Id = null;
  try {
    const { data: s1, error } = await rameshClient.rpc('start_work_session', { p_starting_form: 1000 });
    if (!error && s1?.success) {
      session1Id = s1.session?.id || s1.id;
      recordTest('4A. Start Session 1 (Start = 1000)', 'PASS', `Session ID: ${session1Id}`);
    } else {
      recordTest('4A. Start Session 1 (Start = 1000)', 'FAIL', error?.message || s1?.error);
    }
  } catch (err) {
    recordTest('4A. Start Session 1 (Start = 1000)', 'FAIL', err.message);
  }

  // Test 4B: Prevent Duplicate Active Sessions
  try {
    const { data: s2, error } = await rameshClient.rpc('start_work_session', { p_starting_form: 1001 });
    if (s2?.success === false || error) {
      recordTest('4B. Prevent Duplicate Active Session', 'PASS', s2?.error || 'Active session exists');
    } else {
      recordTest('4B. Prevent Duplicate Active Session', 'FAIL', 'Allowed starting 2 active sessions simultaneously!');
    }
  } catch (err) {
    recordTest('4B. Prevent Duplicate Active Session', 'PASS', err.message);
  }

  // Test 4C: Finish Session 1 at 1050 (Calculation Test: 1050 - 1000 + 1 = 51)
  try {
    const { data: res, error } = await rameshClient.rpc('complete_work_session', {
      p_session_id: session1Id,
      p_ending_form: 1050
    });
    if (!error && res?.success) {
      const totalForms = res.session?.total_forms;
      if (totalForms === 51) {
        recordTest('4C. Complete Session 1 (1000 -> 1050)', 'PASS', `Total Forms = ${totalForms} (Expected 51)`);
      } else {
        recordTest('4C. Complete Session 1 (1000 -> 1050)', 'FAIL', `Expected 51 forms, got ${totalForms}`);
      }
    } else {
      recordTest('4C. Complete Session 1 (1000 -> 1050)', 'FAIL', error?.message || res?.error);
    }
  } catch (err) {
    recordTest('4C. Complete Session 1 (1000 -> 1050)', 'FAIL', err.message);
  }

  // Test 4D: Next Starting Form Auto-suggestion / Validation (Must be 1051)
  try {
    const { data: res, error } = await rameshClient.rpc('get_expected_next_form');
    const expected = res?.expected_next || res?.expected_start || res;
    if (!error && Number(expected) === 1051) {
      recordTest('4D. Next Form Auto-suggestion (Expected 1051)', 'PASS', `Suggested next: ${expected}`);
    } else {
      recordTest('4D. Next Form Auto-suggestion (Expected 1051)', 'FAIL', `Expected 1051, got ${JSON.stringify(res)}`);
    }
  } catch (err) {
    recordTest('4D. Next Form Auto-suggestion (Expected 1051)', 'FAIL', err.message);
  }

  // Test 4E: Wrong Starting Form Rejection (Try starting at 1100 when 1051 expected)
  try {
    const { data: res, error } = await rameshClient.rpc('start_work_session', { p_starting_form: 1100 });
    if (res?.success === false || error) {
      recordTest('4E. Reject Wrong Next Start (Try 1100 vs 1051)', 'PASS', res?.error || 'Rejected invalid start');
    } else {
      recordTest('4E. Reject Wrong Next Start (Try 1100 vs 1051)', 'FAIL', 'Allowed starting at 1100 instead of 1051');
    }
  } catch (err) {
    recordTest('4E. Reject Wrong Next Start (Try 1100 vs 1051)', 'PASS', err.message);
  }

  // Test 4F: Start Session 2 at 1051 and Finish at 1100 (50 forms)
  let session2Id = null;
  try {
    const { data: s2 } = await rameshClient.rpc('start_work_session', { p_starting_form: 1051 });
    session2Id = s2.session?.id;
    const { data: res2 } = await rameshClient.rpc('complete_work_session', {
      p_session_id: session2Id,
      p_ending_form: 1100
    });
    if (res2?.session?.total_forms === 50) {
      recordTest('4F. Complete Session 2 (1051 -> 1100)', 'PASS', 'Total Forms = 50');
    } else {
      recordTest('4F. Complete Session 2 (1051 -> 1100)', 'FAIL', `Got ${res2?.session?.total_forms}`);
    }
  } catch (err) {
    recordTest('4F. Complete Session 2 (1051 -> 1100)', 'FAIL', err.message);
  }

  // Test 4G: Start Session 3 at 1101 and Finish at 1150 (50 forms)
  let session3Id = null;
  try {
    const { data: s3 } = await rameshClient.rpc('start_work_session', { p_starting_form: 1101 });
    session3Id = s3.session?.id;
    const { data: res3 } = await rameshClient.rpc('complete_work_session', {
      p_session_id: session3Id,
      p_ending_form: 1150
    });
    if (res3?.session?.total_forms === 50) {
      recordTest('4G. Complete Session 3 (1101 -> 1150)', 'PASS', 'Total Forms = 50');
    } else {
      recordTest('4G. Complete Session 3 (1101 -> 1150)', 'FAIL', `Got ${res3?.session?.total_forms}`);
    }
  } catch (err) {
    recordTest('4G. Complete Session 3 (1101 -> 1150)', 'FAIL', err.message);
  }

  // Test 4H: Daily Total Verification (51 + 50 + 50 = 151)
  try {
    const { data: sessions } = await rameshClient
      .from('work_sessions')
      .select('total_forms')
      .eq('work_date', todayStr);
    
    const dailyTotal = (sessions || []).reduce((sum, s) => sum + (s.total_forms || 0), 0);
    if (dailyTotal === 151) {
      recordTest('4H. Multi-Session Daily Total Calculation', 'PASS', `Total = 151 forms across 3 sessions`);
    } else {
      recordTest('4H. Multi-Session Daily Total Calculation', 'FAIL', `Expected 151, got ${dailyTotal}`);
    }
  } catch (err) {
    recordTest('4H. Multi-Session Daily Total Calculation', 'FAIL', err.message);
  }

  // ----------------------------------------------------------------
  // 5. SECURITY & RLS TESTS
  // ----------------------------------------------------------------
  console.log('\n--- 5. SECURITY & RLS TESTS ---');

  // Test 5A: RLS Employee Data Isolation
  // Login as Manoj and try to access Ramesh's sessions
  try {
    const manojClient = createClient(supabaseUrl, supabaseAnonKey);
    await manojClient.auth.signInWithPassword({ email: 'manoj@vkit.local', password: 'VKIt@Manoj2026!' });
    const { data: enemySessions } = await manojClient
      .from('work_sessions')
      .select('*')
      .eq('employee_id', rameshUserId);
    
    if (!enemySessions || enemySessions.length === 0) {
      recordTest('5A. RLS Employee Data Isolation', 'PASS', 'Employee Manoj cannot read Ramesh sessions');
    } else {
      recordTest('5A. RLS Employee Data Isolation', 'FAIL', 'Security Leak! Manoj read Ramesh sessions');
    }
  } catch (err) {
    recordTest('5A. RLS Employee Data Isolation', 'PASS', err.message);
  }

  // Test 5B: Completed Session Immutability
  try {
    const { error: updateErr } = await rameshClient
      .from('work_sessions')
      .update({ total_forms: 9999 })
      .eq('id', session1Id);

    if (updateErr) {
      recordTest('5B. Completed Session Immutability', 'PASS', 'RLS blocked employee modification');
    } else {
      // Re-verify if data actually changed
      const { data: s1 } = await rameshClient.from('work_sessions').select('total_forms').eq('id', session1Id).single();
      if (s1.total_forms === 51) {
        recordTest('5B. Completed Session Immutability', 'PASS', 'Record value remained 51');
      } else {
        recordTest('5B. Completed Session Immutability', 'FAIL', 'Employee modified completed session!');
      }
    }
  } catch (err) {
    recordTest('5B. Completed Session Immutability', 'PASS', err.message);
  }

  // Test 5C: Employee Delete Protection
  try {
    const { error: delErr } = await rameshClient
      .from('work_sessions')
      .delete()
      .eq('id', session1Id);
    
    if (delErr) {
      recordTest('5C. Employee Delete Protection', 'PASS', 'RLS blocked session deletion');
    } else {
      const { data: check } = await rameshClient.from('work_sessions').select('id').eq('id', session1Id).maybeSingle();
      if (check) {
        recordTest('5C. Employee Delete Protection', 'PASS', 'Session preserved');
      } else {
        recordTest('5C. Employee Delete Protection', 'FAIL', 'Employee deleted session!');
      }
    }
  } catch (err) {
    recordTest('5C. Employee Delete Protection', 'PASS', err.message);
  }

  // ----------------------------------------------------------------
  // 6. ADMIN SUMMARY & EXCEL DATA TESTS
  // ----------------------------------------------------------------
  console.log('\n--- 6. ADMIN SUMMARY & EXCEL EXPORT TESTS ---');
  try {
    const { data: adminSessions, error: sessErr } = await adminClient.from('work_sessions').select('*').eq('work_date', todayStr);
    
    if (!sessErr && adminSessions && adminSessions.length >= 3) {
      recordTest('6A. Admin Session View & Reporting', 'PASS', `Admin sees ${adminSessions.length} total sessions today`);
    } else {
      recordTest('6A. Admin Session View & Reporting', 'FAIL', sessErr?.message || 'Admin missing session records');
    }
  } catch (err) {
    recordTest('6A. Admin Session View & Reporting', 'FAIL', err.message);
  }

  // ----------------------------------------------------------------
  // TEST SUMMARY & FINAL REPORT
  // ----------------------------------------------------------------
  console.log('\n================================================================');
  console.log(` RESULTS: ${testReport.passed.length} PASSED | ${testReport.failed.length} FAILED`);
  console.log('================================================================\n');

  if (testReport.failed.length === 0) {
    console.log('🎉 ALL AUTOMATED E2E TESTS PASSED SUCCESSFULLY!\n');
  } else {
    console.log('⚠️ SOME TESTS FAILED. DETAILS:');
    testReport.failed.forEach(f => console.log(` - ${f.name}: ${f.error}`));
  }

  return testReport;
}

runE2ESuite();
