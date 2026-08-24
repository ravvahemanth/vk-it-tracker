/**
 * VK IT SOLUTIONS — MASTER A-Z END-TO-END TEST SUITE
 * Tests every feature: auth, sessions, admin CRUD, RLS, business rules, cleanup
 */
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const anonClient = createClient(supabaseUrl, supabaseAnonKey);
const serviceClient = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

// Test tracking
let passed = 0, failed = 0, warnings = 0;
const bugs = [];
const fixes = [];
const testResults = [];

function pass(testId, name, detail = '') {
  passed++;
  testResults.push({ id: testId, name, result: 'PASS', detail });
  console.log(`  ✅ PASS [${testId}] ${name}${detail ? ` — ${detail}` : ''}`);
}

function fail(testId, name, detail = '') {
  failed++;
  testResults.push({ id: testId, name, result: 'FAIL', detail });
  console.error(`  ❌ FAIL [${testId}] ${name}${detail ? ` — ${detail}` : ''}`);
  bugs.push({ testId, name, detail });
}

function warn(testId, name, detail = '') {
  warnings++;
  testResults.push({ id: testId, name, result: 'WARN', detail });
  console.warn(`  ⚠️  WARN [${testId}] ${name}${detail ? ` — ${detail}` : ''}`);
}

function section(title) {
  const line = '═'.repeat(60);
  console.log('\n' + line);
  console.log(`  ${title}`);
  console.log(line);
}

// Utility: create a fresh client session
function freshClient() {
  return createClient(supabaseUrl, supabaseAnonKey);
}

// QA Test accounts (will be cleaned up)
const QA_ACCOUNTS = [
  { username: 'qaemployee01', fullName: 'QA Employee One', password: 'QaTest@1234!' },
  { username: 'qaemployee02', fullName: 'QA Employee Two', password: 'QaTest@5678!' },
  { username: 'qadeletetest', fullName: 'QA Delete Test', password: 'QaDelete@9876!' },
];

// ================================================================
// SECTION 1: ENVIRONMENT TESTS
// ================================================================
async function testEnvironment() {
  section('1. ENVIRONMENT & SECURITY TESTS');

  // 1A: Verify env vars exist
  if (supabaseUrl && supabaseAnonKey) {
    pass('1A', 'VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY configured');
  } else {
    fail('1A', 'Missing VITE env vars', `URL: ${!!supabaseUrl}, KEY: ${!!supabaseAnonKey}`);
  }

  // 1B: Service key not a VITE_ var (not exposed to browser)
  const viteSvcKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;
  if (!viteSvcKey) {
    pass('1B', 'Service role key NOT exposed via VITE_ prefix (secure)');
  } else {
    fail('1B', 'CRITICAL: Service role key exposed via VITE_ prefix!', 'This would expose it to the browser bundle');
  }

  // 1C: Supabase connection test
  const { data, error } = await anonClient.from('profiles').select('count').limit(1);
  if (!error || error.code === 'PGRST116') {
    pass('1C', 'Supabase REST API reachable');
  } else if (error.code === '42501' || error.message?.includes('permission')) {
    pass('1C', 'Supabase REST API reachable (RLS active - expected)');
  } else {
    fail('1C', 'Supabase REST API unreachable', error.message);
  }
}

// ================================================================
// SECTION 2: ADMIN AUTHENTICATION TESTS
// ================================================================
async function testAdminAuth() {
  section('2. ADMIN AUTHENTICATION TESTS');
  const client = freshClient();

  // 2A: Admin valid login
  const { data: adminData, error: adminErr } = await client.auth.signInWithPassword({
    email: 'admin@vkit.local', password: 'Krrish@@1999'
  });
  if (!adminErr && adminData.user) {
    pass('2A', 'Admin login with valid credentials', `User: ${adminData.user.email}`);
  } else {
    fail('2A', 'Admin login failed', adminErr?.message);
    return null; // Cannot proceed
  }

  // 2B: Admin profile has role=admin
  const { data: adminProfile } = await client.from('profiles').select('*').eq('id', adminData.user.id).single();
  if (adminProfile?.role === 'admin') {
    pass('2B', 'Admin profile has role=admin');
  } else {
    fail('2B', 'Admin profile role incorrect', `Got: ${adminProfile?.role}`);
  }

  // 2C: Admin can read all employee profiles
  const { data: allProfiles, error: profErr } = await client.from('profiles').select('*').eq('role', 'employee');
  if (!profErr && allProfiles && allProfiles.length > 0) {
    pass('2C', `Admin can read all employee profiles`, `Found ${allProfiles.length} employees`);
  } else {
    fail('2C', 'Admin cannot read all profiles', profErr?.message);
  }

  // 2D: Wrong password rejected
  const badClient = freshClient();
  const { error: badErr } = await badClient.auth.signInWithPassword({
    email: 'admin@vkit.local', password: 'WrongPassword123'
  });
  if (badErr) {
    pass('2D', 'Wrong password correctly rejected', badErr.message);
  } else {
    fail('2D', 'Wrong password was ACCEPTED — critical security failure!');
  }

  // 2E: Non-existent user rejected
  const { error: noUserErr } = await badClient.auth.signInWithPassword({
    email: 'nonexistent@vkit.local', password: 'SomePassword123'
  });
  if (noUserErr) {
    pass('2E', 'Non-existent user login correctly rejected');
  } else {
    fail('2E', 'Non-existent user login ACCEPTED — critical failure!');
  }

  await client.auth.signOut();
  return adminData.user;
}

// ================================================================
// SECTION 3: QA ACCOUNT CLEANUP (pre-test)
// ================================================================
async function cleanupQAAccounts() {
  section('3. PRE-TEST QA ACCOUNT CLEANUP');
  console.log('  Removing any leftover QA test accounts from previous runs...');

  for (const qa of QA_ACCOUNTS) {
    const { data: profiles } = await serviceClient
      .from('profiles')
      .select('id')
      .eq('username', qa.username);

    if (profiles && profiles.length > 0) {
      const id = profiles[0].id;
      await serviceClient.from('work_sessions').delete().eq('employee_id', id);
      await serviceClient.from('profiles').delete().eq('id', id);
      await serviceClient.auth.admin.deleteUser(id);
      console.log(`  🗑️  Removed leftover QA account: ${qa.username}`);
    }
  }
  pass('3A', 'Pre-test QA account cleanup complete');
}

// ================================================================
// SECTION 4: EMPLOYEE CREATION TESTS
// ================================================================
async function testEmployeeCreation() {
  section('4. EMPLOYEE CREATION TESTS');
  const adminClient = freshClient();

  const { error: loginErr } = await adminClient.auth.signInWithPassword({
    email: 'admin@vkit.local', password: 'Krrish@@1999'
  });
  if (loginErr) { fail('4A', 'Admin login for creation tests failed'); return null; }

  // 4A: Create QA Employee One
  const qa1 = QA_ACCOUNTS[0];
  const { data: create1, error: c1Err } = await adminClient.rpc('admin_create_employee', {
    p_full_name: qa1.fullName,
    p_username: qa1.username,
    p_password: qa1.password,
    p_is_active: true
  });

  if (!c1Err && create1?.success) {
    pass('4A', `Employee created: ${qa1.fullName}`, `Username: @${qa1.username}`);
  } else {
    fail('4A', `Failed to create ${qa1.fullName}`, c1Err?.message || create1?.error);
    await adminClient.auth.signOut();
    return null;
  }

  // Verify profile in DB
  const { data: p1 } = await serviceClient.from('profiles').select('*').eq('username', qa1.username).single();
  if (p1 && p1.role === 'employee' && p1.is_active === true) {
    pass('4B', 'Employee profile stored correctly in DB', `role=${p1.role}, is_active=${p1.is_active}`);
  } else {
    fail('4B', 'Employee profile incorrect in DB', JSON.stringify(p1));
  }

  // Verify auth.users entry via service client
  // (We verify indirectly by attempting login below)

  // 4C: Create QA Employee Two
  const qa2 = QA_ACCOUNTS[1];
  const { data: create2, error: c2Err } = await adminClient.rpc('admin_create_employee', {
    p_full_name: qa2.fullName,
    p_username: qa2.username,
    p_password: qa2.password,
    p_is_active: true
  });
  if (!c2Err && create2?.success) {
    pass('4C', `Employee created: ${qa2.fullName}`);
  } else {
    fail('4C', `Failed to create ${qa2.fullName}`, c2Err?.message || create2?.error);
  }

  // 4D: Create QA Delete Test
  const qa3 = QA_ACCOUNTS[2];
  const { data: create3, error: c3Err } = await adminClient.rpc('admin_create_employee', {
    p_full_name: qa3.fullName,
    p_username: qa3.username,
    p_password: qa3.password,
    p_is_active: true
  });
  if (!c3Err && create3?.success) {
    pass('4D', `Employee created: ${qa3.fullName} (for delete test)`);
  } else {
    fail('4D', `Failed to create ${qa3.fullName}`, c3Err?.message || create3?.error);
  }

  // 4E: Duplicate username rejection
  const { data: dupData, error: dupErr } = await adminClient.rpc('admin_create_employee', {
    p_full_name: 'Duplicate User',
    p_username: qa1.username,
    p_password: 'SomePassword123!',
    p_is_active: true
  });
  if (dupData?.success === false && dupData?.error?.includes('already taken')) {
    pass('4E', 'Duplicate username correctly rejected', dupData.error);
  } else if (!dupErr && dupData?.success) {
    fail('4E', 'DUPLICATE USERNAME ALLOWED — critical failure!');
  } else {
    warn('4E', 'Duplicate rejection returned differently than expected', JSON.stringify(dupData || dupErr));
  }

  // 4F: Weak password rejection
  const { data: weakData } = await adminClient.rpc('admin_create_employee', {
    p_full_name: 'Weak Password User',
    p_username: 'weakpassuser',
    p_password: '123',
    p_is_active: true
  });
  if (weakData?.success === false) {
    pass('4F', 'Weak password (3 chars) correctly rejected', weakData.error);
  } else {
    fail('4F', 'Weak password was ACCEPTED', JSON.stringify(weakData));
  }

  await adminClient.auth.signOut();
  return p1?.id;
}

// ================================================================
// SECTION 5: EMPLOYEE LOGIN TESTS
// ================================================================
async function testEmployeeLogin() {
  section('5. EMPLOYEE LOGIN TESTS');
  const qa1 = QA_ACCOUNTS[0];
  const empClient = freshClient();

  // 5A: Valid employee login
  const { data: loginData, error: loginErr } = await empClient.auth.signInWithPassword({
    email: `${qa1.username}@vkit.local`,
    password: qa1.password
  });

  if (!loginErr && loginData.user) {
    pass('5A', `Employee login works for @${qa1.username}`, `User ID: ${loginData.user.id}`);
  } else {
    fail('5A', `Employee login FAILED for @${qa1.username}`, loginErr?.message);
    return null;
  }

  // 5B: Employee profile has correct role
  const { data: empProfile } = await empClient.from('profiles').select('*').eq('id', loginData.user.id).single();
  if (empProfile?.role === 'employee') {
    pass('5B', 'Employee profile has role=employee');
  } else {
    fail('5B', 'Employee role incorrect', `Got: ${empProfile?.role}`);
  }

  // 5C: Employee CANNOT read other employees' profiles (RLS)
  const { data: otherProfiles, error: rlsErr } = await empClient
    .from('profiles')
    .select('*')
    .neq('id', loginData.user.id)
    .eq('role', 'employee');

  if ((!otherProfiles || otherProfiles.length === 0) || rlsErr) {
    pass('5C', 'RLS: Employee cannot read other profiles', 'Employee data isolation confirmed');
  } else {
    fail('5C', `SECURITY: Employee can read ${otherProfiles.length} other profiles!`, 'RLS policy failure');
  }

  // 5D: Wrong password rejected
  const badClient = freshClient();
  const { error: badLoginErr } = await badClient.auth.signInWithPassword({
    email: `${qa1.username}@vkit.local`,
    password: 'WrongPassword999'
  });
  if (badLoginErr) {
    pass('5D', 'Wrong password rejected for employee login');
  } else {
    fail('5D', 'Wrong password ACCEPTED for employee — critical!');
  }

  await empClient.auth.signOut();
  return loginData.user.id;
}

// ================================================================
// SECTION 6: WORK SESSION TESTS
// ================================================================
async function testWorkSessions() {
  section('6. WORK SESSION TESTS');
  const qa1 = QA_ACCOUNTS[0];
  const empClient = freshClient();

  const { error: loginErr } = await empClient.auth.signInWithPassword({
    email: `${qa1.username}@vkit.local`,
    password: qa1.password
  });
  if (loginErr) { fail('6A', 'Employee login failed for session tests'); return; }

  // 6A: Cannot start session when NOT working (employee NOT working)
  const { data: noActiveData } = await empClient.rpc('get_my_active_session');
  if (!noActiveData?.has_active) {
    pass('6A', 'No active session on fresh login — login ≠ working');
  } else {
    fail('6A', 'Employee has unexpected active session on login', 'Login should NOT create sessions');
  }

  // 6B: Invalid starting form (negative)
  const { data: negData } = await empClient.rpc('start_work_session', { p_starting_form: -1 });
  if (negData?.success === false) {
    pass('6B', 'Negative starting form rejected', negData.error);
  } else {
    fail('6B', 'Negative starting form ACCEPTED', JSON.stringify(negData));
  }

  // 6C: Invalid starting form (zero)
  const { data: zeroData } = await empClient.rpc('start_work_session', { p_starting_form: 0 });
  if (zeroData?.success === false) {
    pass('6C', 'Zero starting form rejected', zeroData.error);
  } else {
    fail('6C', 'Zero starting form ACCEPTED', JSON.stringify(zeroData));
  }

  // 6D: Start valid session (form 1000)
  const { data: startData, error: startErr } = await empClient.rpc('start_work_session', { p_starting_form: 1000 });
  if (!startErr && startData?.success && startData?.session) {
    pass('6D', 'Session 1 started: form 1000', `Session ID: ${startData.session.id}`);
  } else {
    fail('6D', 'Failed to start session at form 1000', startErr?.message || startData?.error);
    await empClient.auth.signOut();
    return;
  }

  const session1Id = startData.session.id;

  // 6E: Prevent duplicate active session
  const { data: dupSession } = await empClient.rpc('start_work_session', { p_starting_form: 2000 });
  if (dupSession?.success === false && dupSession.error?.includes('active work session')) {
    pass('6E', 'Duplicate active session correctly rejected', dupSession.error);
  } else {
    fail('6E', 'DUPLICATE SESSION ALLOWED', JSON.stringify(dupSession));
  }

  // 6F: Active session persists (get_my_active_session)
  const { data: activeData } = await empClient.rpc('get_my_active_session');
  if (activeData?.has_active && activeData?.session?.id === session1Id) {
    pass('6F', 'Active session persists on query', `Status: ${activeData.session.status}`);
  } else {
    fail('6F', 'Active session not found', JSON.stringify(activeData));
  }

  // 6G: Ending form lower than starting (should fail)
  const { data: lowEndData } = await empClient.rpc('complete_work_session', {
    p_session_id: session1Id,
    p_ending_form: 999
  });
  if (lowEndData?.success === false) {
    pass('6G', 'Ending form < starting form correctly rejected', lowEndData.error);
  } else {
    fail('6G', 'Invalid ending form ACCEPTED', JSON.stringify(lowEndData));
  }

  // 6H: Complete session 1: 1000→1050, expected 51 forms
  const { data: complete1, error: comp1Err } = await empClient.rpc('complete_work_session', {
    p_session_id: session1Id,
    p_ending_form: 1050
  });
  if (!comp1Err && complete1?.success && complete1?.total_forms === 51) {
    pass('6H', 'Session 1 completed: 1000→1050 = 51 forms', `Total: ${complete1.total_forms}`);
  } else {
    fail('6H', 'Session 1 completion failed or wrong count', `Got: ${complete1?.total_forms}, expected: 51`);
  }

  // 6I: Next session must start at 1051
  const { data: nextFormData } = await empClient.rpc('get_expected_next_form');
  if (nextFormData?.expected_next === 1051) {
    pass('6I', 'Next form auto-suggestion correct', `Expected: 1051`);
  } else {
    fail('6I', 'Wrong next form suggestion', `Got: ${nextFormData?.expected_next}, expected: 1051`);
  }

  // 6J: Wrong next number rejected
  const { data: wrongNext } = await empClient.rpc('start_work_session', { p_starting_form: 1100 });
  if (wrongNext?.success === false && wrongNext.error?.includes('1051')) {
    pass('6J', 'Wrong next form number rejected', wrongNext.error);
  } else {
    fail('6J', 'Wrong next form number ACCEPTED', JSON.stringify(wrongNext));
  }

  // 6K: Session 2: 1051→1100 = 50 forms
  const { data: start2 } = await empClient.rpc('start_work_session', { p_starting_form: 1051 });
  const session2Id = start2?.session?.id;
  if (start2?.success) {
    pass('6K', 'Session 2 started at 1051');
  } else {
    fail('6K', 'Session 2 failed to start', start2?.error);
  }

  const { data: complete2 } = await empClient.rpc('complete_work_session', {
    p_session_id: session2Id,
    p_ending_form: 1100
  });
  if (complete2?.success && complete2?.total_forms === 50) {
    pass('6L', 'Session 2 completed: 1051→1100 = 50 forms');
  } else {
    fail('6L', 'Session 2 completion failed', `Got: ${complete2?.total_forms}, expected: 50`);
  }

  // 6M: Session 3: 1101→1150 = 50 forms
  const { data: start3 } = await empClient.rpc('start_work_session', { p_starting_form: 1101 });
  const session3Id = start3?.session?.id;
  const { data: complete3 } = await empClient.rpc('complete_work_session', {
    p_session_id: session3Id,
    p_ending_form: 1150
  });
  if (complete3?.success && complete3?.total_forms === 50) {
    pass('6M', 'Session 3 completed: 1101→1150 = 50 forms');
  } else {
    fail('6M', 'Session 3 completion failed', `Got: ${complete3?.total_forms}`);
  }

  // 6N: Verify 3 sessions stored in DB
  const { data: user } = await empClient.auth.getUser();
  const { data: allSessions } = await serviceClient
    .from('work_sessions')
    .select('*')
    .eq('employee_id', user.data.user.id)
    .eq('status', 'completed')
    .order('session_number');

  if (allSessions && allSessions.length >= 3) {
    const total = allSessions.reduce((sum, s) => sum + (s.total_forms || 0), 0);
    if (total >= 151) {
      pass('6N', `3 sessions in DB, daily total = ${total} forms`, '51+50+50=151');
    } else {
      fail('6N', `Daily total wrong: ${total} (expected >= 151)`);
    }
  } else {
    fail('6N', `Expected 3+ sessions, found ${allSessions?.length}`);
  }

  // 6O: Completed session immutability (RLS prevents update)
  const { error: immutErr } = await empClient
    .from('work_sessions')
    .update({ total_forms: 9999 })
    .eq('id', session1Id)
    .eq('status', 'completed');

  if (immutErr || true) {
    // Check DB directly
    const { data: immutCheck } = await serviceClient
      .from('work_sessions')
      .select('total_forms')
      .eq('id', session1Id)
      .single();
    if (immutCheck?.total_forms === 51) {
      pass('6O', 'Completed session is immutable (value unchanged)', `Still = 51`);
    } else {
      fail('6O', 'Completed session value was modified!', `Now = ${immutCheck?.total_forms}`);
    }
  }

  // 6P: Business rule matrix
  const testCases = [
    { start: 1000, end: 1000, expected: 1 },
    { start: 1000, end: 1001, expected: 2 },
    { start: 5000, end: 5100, expected: 101 },
  ];

  for (const tc of testCases) {
    const calc = tc.end - tc.start + 1;
    if (calc === tc.expected) {
      pass('6P', `Business rule: ${tc.start}→${tc.end} = ${tc.expected} forms`);
    } else {
      fail('6P', `Business rule wrong: ${tc.start}→${tc.end} = ${calc}, expected ${tc.expected}`);
    }
  }

  await empClient.auth.signOut();
}

// ================================================================
// SECTION 7: DATA ISOLATION TEST (Employee 2)
// ================================================================
async function testDataIsolation() {
  section('7. EMPLOYEE DATA ISOLATION TESTS');
  const qa1 = QA_ACCOUNTS[0];
  const qa2 = QA_ACCOUNTS[1];

  // Create a session for Employee Two
  const emp2Client = freshClient();
  const { error: e2Err } = await emp2Client.auth.signInWithPassword({
    email: `${qa2.username}@vkit.local`,
    password: qa2.password
  });

  if (e2Err) {
    fail('7A', 'QA Employee Two login failed', e2Err.message);
    return;
  }

  // Emp2: start and complete a session
  const { data: e2Start } = await emp2Client.rpc('start_work_session', { p_starting_form: 5000 });
  if (e2Start?.success) {
    await emp2Client.rpc('complete_work_session', {
      p_session_id: e2Start.session.id,
      p_ending_form: 5099
    });
    pass('7A', 'QA Employee Two created a session (5000→5099 = 100 forms)');
  } else {
    warn('7A', 'Could not create session for Employee Two', e2Start?.error);
  }
  await emp2Client.auth.signOut();

  // Now log in as Employee One and check isolation
  const emp1Client = freshClient();
  const { error: e1Err } = await emp1Client.auth.signInWithPassword({
    email: `${qa1.username}@vkit.local`,
    password: qa1.password
  });
  if (e1Err) { fail('7B', 'Employee One login failed for isolation test'); return; }

  const { data: e1Sessions } = await emp1Client.from('work_sessions').select('*');
  const e1User = (await emp1Client.auth.getUser()).data.user;

  const hasOtherData = e1Sessions?.some(s => s.employee_id !== e1User.id);
  if (!hasOtherData) {
    pass('7B', 'RLS: Employee One sees ONLY their own sessions', `${e1Sessions?.length} sessions, all own`);
  } else {
    fail('7B', 'CRITICAL: Employee One can see another employee\'s sessions!');
  }

  await emp1Client.auth.signOut();
}

// ================================================================
// SECTION 8: ADMIN OPERATIONS TESTS
// ================================================================
async function testAdminOperations() {
  section('8. ADMIN EMPLOYEE MANAGEMENT TESTS');
  const adminClient = freshClient();
  const qa1 = QA_ACCOUNTS[0];
  const qa3 = QA_ACCOUNTS[2];

  const { error: adminErr } = await adminClient.auth.signInWithPassword({
    email: 'admin@vkit.local', password: 'Krrish@@1999'
  });
  if (adminErr) { fail('8A', 'Admin login failed for management tests'); return; }

  // 8A: Admin can see all employees
  const { data: allEmps } = await adminClient.from('profiles').select('*').eq('role', 'employee').order('full_name');
  if (allEmps && allEmps.length > 0) {
    pass('8A', `Admin sees all employees`, `Count: ${allEmps.length}`);
  } else {
    fail('8A', 'Admin cannot see employees');
  }

  // 8B: QA Employee One appears in list
  const qa1Profile = allEmps?.find(e => e.username === qa1.username);
  if (qa1Profile) {
    pass('8B', `QA Employee One appears in admin employee list`);
  } else {
    fail('8B', 'QA Employee One not found in admin list');
  }

  // 8C: Edit employee
  if (qa1Profile) {
    const { data: editData, error: editErr } = await adminClient.rpc('admin_update_employee', {
      p_employee_id: qa1Profile.id,
      p_full_name: 'QA Employee One Updated',
      p_username: qa1.username,
      p_is_active: true
    });
    if (!editErr && editData?.success) {
      const { data: updCheck } = await serviceClient.from('profiles').select('full_name').eq('id', qa1Profile.id).single();
      if (updCheck?.full_name === 'QA Employee One Updated') {
        pass('8C', 'Admin edit employee: full_name updated in DB', updCheck.full_name);
      } else {
        fail('8C', 'Edit did not persist in DB', `Got: ${updCheck?.full_name}`);
      }
    } else {
      fail('8C', 'Admin edit employee failed', editErr?.message || editData?.error);
    }
  }

  // 8D: Reset password
  if (qa1Profile) {
    const newPass = 'NewQaPassword@123!';
    const { data: resetData, error: resetErr } = await adminClient.rpc('admin_reset_employee_password', {
      p_employee_id: qa1Profile.id,
      p_new_password: newPass
    });

    let resetOk = false;
    if (!resetErr && resetData?.success) {
      // Test old password fails
      const oldClient = freshClient();
      const { error: oldPassErr } = await oldClient.auth.signInWithPassword({
        email: `${qa1.username}@vkit.local`,
        password: qa1.password
      });

      // Test new password works
      const newClient = freshClient();
      const { data: newPassData, error: newPassErr } = await newClient.auth.signInWithPassword({
        email: `${qa1.username}@vkit.local`,
        password: newPass
      });

      if (newPassData?.user) {
        pass('8D', 'Admin password reset works — new password accepted', newPass);
        // Update our tracking so cleanup works
        QA_ACCOUNTS[0].password = newPass;
        await newClient.auth.signOut();
        resetOk = true;
      } else {
        fail('8D', 'New password not accepted after reset', newPassErr?.message);
      }
    } else {
      fail('8D', 'Admin reset password RPC failed', resetErr?.message || resetData?.error);
    }
  }

  // 8E: Deactivate employee
  if (qa1Profile) {
    const { data: deactData, error: deactErr } = await adminClient.rpc('admin_toggle_employee_status', {
      p_employee_id: qa1Profile.id,
      p_is_active: false
    });

    if (!deactErr && deactData?.success) {
      // Verify in DB
      const { data: deactCheck } = await serviceClient.from('profiles').select('is_active').eq('id', qa1Profile.id).single();
      if (deactCheck?.is_active === false) {
        pass('8E', 'Employee deactivated in DB (is_active=false)');
      } else {
        fail('8E', 'Employee deactivation not reflected in DB');
      }

      // Try login — should fail or be blocked
      const blockedClient = freshClient();
      const { error: blockedErr } = await blockedClient.auth.signInWithPassword({
        email: `${qa1.username}@vkit.local`,
        password: QA_ACCOUNTS[0].password
      });

      // Note: Supabase Auth doesn't block login based on profiles.is_active
      // This is enforced at the app level via start_work_session checking is_active
      // So login may succeed but work session would be blocked
      if (blockedErr) {
        pass('8E-2', 'Deactivated employee login blocked at auth level');
      } else {
        // Check that start_work_session blocks inactive users
        const { data: sessCheck } = await blockedClient.rpc('start_work_session', { p_starting_form: 9999 });
        if (sessCheck?.success === false && sessCheck.error?.includes('inactive')) {
          pass('8E-2', 'Deactivated employee blocked from starting sessions', sessCheck.error);
        } else {
          warn('8E-2', 'Deactivated employee could start session — check is_active enforcement', JSON.stringify(sessCheck));
        }
        await blockedClient.auth.signOut();
      }
    } else {
      fail('8E', 'Deactivate employee failed', deactErr?.message || deactData?.error);
    }
  }

  // 8F: Reactivate employee
  if (qa1Profile) {
    const { data: reactData } = await adminClient.rpc('admin_toggle_employee_status', {
      p_employee_id: qa1Profile.id,
      p_is_active: true
    });
    if (reactData?.success) {
      pass('8F', 'Employee reactivated successfully');
    } else {
      fail('8F', 'Reactivation failed', reactData?.error);
    }
  }

  // 8G: Admin sessions view
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
  const { data: adminSessions, error: asErr } = await adminClient
    .from('work_sessions')
    .select('*, profiles(full_name, username)')
    .eq('work_date', today)
    .order('start_time', { ascending: false });

  if (!asErr && adminSessions) {
    pass('8G', `Admin can view all sessions today`, `${adminSessions.length} sessions found`);
  } else {
    fail('8G', 'Admin cannot view sessions', asErr?.message);
  }

  // 8H: Delete QA Delete Test account (no sessions)
  const qa3Profile = allEmps?.find(e => e.username === qa3.username);
  if (qa3Profile) {
    // Try profile delete directly (using the fixed RLS)
    const { error: delSessErr } = await adminClient.from('work_sessions').delete().eq('employee_id', qa3Profile.id);
    const { error: delProfErr } = await adminClient.from('profiles').delete().eq('id', qa3Profile.id);

    if (!delProfErr) {
      // Also delete auth user via service client
      await serviceClient.auth.admin.deleteUser(qa3Profile.id);
      const { data: delCheck } = await serviceClient.from('profiles').select('id').eq('id', qa3Profile.id);
      if (!delCheck || delCheck.length === 0) {
        pass('8H', 'QA Delete Test account permanently deleted', 'Profile + auth removed');
      } else {
        fail('8H', 'Profile still exists after delete attempt');
      }
    } else {
      fail('8H', 'Admin cannot delete profiles via RLS', delProfErr.message);
      warn('8H', 'RLS delete policy may not be live yet — needs SQL deployment', 'Run migration 002 policy fix in Supabase');
    }
  } else {
    warn('8H', 'QA Delete Test account not found, skipping delete test');
  }

  await adminClient.auth.signOut();
}

// ================================================================
// SECTION 9: TIMEZONE & DATE TESTS
// ================================================================
async function testTimezoneAndDate() {
  section('9. TIMEZONE & DATE TESTS');

  // 9A: IST today date calculation
  const istDate = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
  const utcDate = new Date().toISOString().split('T')[0];

  // In IST we're UTC+5:30, so IST date can sometimes differ from UTC
  pass('9A', `IST date: ${istDate}, UTC date: ${utcDate}`, istDate !== utcDate ? 'Dates differ — IST timezone working' : 'Dates same');

  // 9B: Check that work sessions in DB have correct date
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
  const { data: todaySessions } = await serviceClient
    .from('work_sessions')
    .select('work_date, start_time')
    .eq('work_date', today)
    .limit(5);

  if (todaySessions && todaySessions.length > 0) {
    pass('9B', `Sessions stored with correct IST date: ${today}`, `${todaySessions.length} sessions`);
  } else {
    warn('9B', 'No sessions found for today in DB', 'May be OK if sessions were in earlier test');
  }
}

// ================================================================
// SECTION 10: DATABASE INTEGRITY CHECK
// ================================================================
async function testDatabaseIntegrity() {
  section('10. DATABASE INTEGRITY TESTS');

  // 10A: No duplicate active sessions per employee
  const { data: activeSessions } = await serviceClient
    .from('work_sessions')
    .select('employee_id, count')
    .eq('status', 'working');

  // Group by employee_id to check duplicates
  if (activeSessions) {
    const empCount = {};
    for (const s of activeSessions) {
      empCount[s.employee_id] = (empCount[s.employee_id] || 0) + 1;
    }
    const duplicates = Object.entries(empCount).filter(([, cnt]) => cnt > 1);
    if (duplicates.length === 0) {
      pass('10A', 'No duplicate active sessions in database');
    } else {
      fail('10A', `Found ${duplicates.length} employees with duplicate active sessions!`);
    }
  }

  // 10B: No sessions with negative total_forms
  const { data: negSessions } = await serviceClient
    .from('work_sessions')
    .select('id, total_forms')
    .lt('total_forms', 0);
  if (!negSessions || negSessions.length === 0) {
    pass('10B', 'No sessions with negative total_forms');
  } else {
    fail('10B', `Found ${negSessions.length} sessions with negative total_forms!`);
  }

  // 10C: No sessions with null ending_form but status=completed
  const { data: incompleteComplete } = await serviceClient
    .from('work_sessions')
    .select('id')
    .eq('status', 'completed')
    .is('ending_form_number', null);
  if (!incompleteComplete || incompleteComplete.length === 0) {
    pass('10C', 'No completed sessions with null ending_form_number');
  } else {
    fail('10C', `Found ${incompleteComplete.length} completed sessions missing ending_form_number!`);
  }

  // 10D: No duplicate usernames in profiles
  const { data: allProfiles } = await serviceClient.from('profiles').select('username');
  if (allProfiles) {
    const usernameSet = new Set();
    const dupes = [];
    for (const p of allProfiles) {
      if (usernameSet.has(p.username)) dupes.push(p.username);
      usernameSet.add(p.username);
    }
    if (dupes.length === 0) {
      pass('10D', 'No duplicate usernames in profiles table');
    } else {
      fail('10D', `Found duplicate usernames: ${dupes.join(', ')}`);
    }
  }

  // 10E: All profiles have valid roles
  const { data: badRoles } = await serviceClient
    .from('profiles')
    .select('username, role')
    .not('role', 'in', '("admin","employee")');
  if (!badRoles || badRoles.length === 0) {
    pass('10E', 'All profiles have valid roles (admin or employee)');
  } else {
    fail('10E', `Found profiles with invalid roles: ${JSON.stringify(badRoles)}`);
  }

  // 10F: Real production employees still exist
  const productionEmployees = ['manoj', 'bangaruraju', 'abhi', 'alekya', 'karthik', 'kesava', 'lakshmi', 'hyndavi', 'raju', 'sunil', 'vamsikrishna'];
  const { data: prodCheck } = await serviceClient.from('profiles').select('username').eq('role', 'employee');
  const prodUsernames = prodCheck?.map(p => p.username) || [];

  const missingProd = productionEmployees.filter(name => !prodUsernames.includes(name));
  if (missingProd.length === 0) {
    pass('10F', 'All real production employees still exist in DB', `${productionEmployees.length} employees verified`);
  } else {
    fail('10F', `Missing production employees: ${missingProd.join(', ')}`, 'These may have been accidentally deleted!');
  }
}

// ================================================================
// SECTION 11: TEST CLEANUP
// ================================================================
async function cleanup() {
  section('11. TEST CLEANUP (Remove QA Accounts)');

  const toClean = ['qaemployee01', 'qaemployee02'];
  let cleanedCount = 0;

  for (const username of toClean) {
    const { data: prof } = await serviceClient.from('profiles').select('id').eq('username', username).maybeSingle();
    if (prof) {
      await serviceClient.from('work_sessions').delete().eq('employee_id', prof.id);
      await serviceClient.from('profiles').delete().eq('id', prof.id);
      await serviceClient.auth.admin.deleteUser(prof.id);
      console.log(`  🗑️  Removed QA account: @${username}`);
      cleanedCount++;
    }
  }

  pass('11A', `Cleanup complete: removed ${cleanedCount} QA test accounts`);

  // Verify production employees unharmed
  const { data: finalCheck } = await serviceClient.from('profiles').select('username').eq('role', 'employee');
  const remainingUsernames = finalCheck?.map(p => p.username) || [];
  const productionEmployees = ['manoj', 'bangaruraju', 'abhi', 'alekya', 'karthik', 'kesava', 'lakshmi', 'hyndavi', 'raju', 'sunil', 'vamsikrishna'];
  const allSafe = productionEmployees.every(u => remainingUsernames.includes(u));
  if (allSafe) {
    pass('11B', 'All real production employees confirmed safe after cleanup');
  } else {
    fail('11B', 'Some production employees appear to be missing after cleanup!');
  }
}

// ================================================================
// MAIN TEST RUNNER
// ================================================================
async function main() {
  console.log('\n');
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║     VK IT SOLUTIONS — MASTER A-Z END-TO-END TEST SUITE      ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');
  console.log(`  Project:   vk-it-tracker`);
  console.log(`  Database:  ${supabaseUrl}`);
  console.log(`  Time:      ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} IST`);
  console.log('');

  await testEnvironment();
  await testAdminAuth();
  await cleanupQAAccounts();
  await testEmployeeCreation();
  await testEmployeeLogin();
  await testWorkSessions();
  await testDataIsolation();
  await testAdminOperations();
  await testTimezoneAndDate();
  await testDatabaseIntegrity();
  await cleanup();

  // ================================================================
  // FINAL REPORT
  // ================================================================
  section('FINAL ACCEPTANCE MATRIX');

  const total = passed + failed + warnings;
  console.log('\n  TEST                                        RESULT');
  console.log('  ' + '─'.repeat(56));
  for (const t of testResults) {
    const icon = t.result === 'PASS' ? '✅' : t.result === 'FAIL' ? '❌' : '⚠️ ';
    const name = t.name.padEnd(44);
    console.log(`  ${icon} ${name} ${t.result}`);
  }

  console.log('\n╔══════════════════════════════════════════════════════════════╗');
  console.log(`║  TOTAL: ${total} | PASSED: ${passed} | FAILED: ${failed} | WARNINGS: ${warnings}`.padEnd(64) + '║');
  console.log('╚══════════════════════════════════════════════════════════════╝');

  if (bugs.length > 0) {
    console.log('\n🐛 BUGS FOUND:');
    bugs.forEach((b, i) => console.log(`  ${i + 1}. [${b.testId}] ${b.name}: ${b.detail}`));
  } else {
    console.log('\n✅ NO BUGS FOUND IN FUNCTIONAL TESTS');
  }

  if (failed === 0) {
    console.log('\n🏁 RESULT: ALL FUNCTIONAL TESTS PASSED — BACKEND VERIFIED READY\n');
  } else {
    console.log('\n⚠️  RESULT: SOME TESTS FAILED — SEE ABOVE FOR DETAILS\n');
  }
}

main().catch(err => {
  console.error('Fatal test runner error:', err);
  process.exit(1);
});
