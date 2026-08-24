import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

console.log('======================================================');
console.log('       SUPABASE HEALTH & FUNCTIONALITY CHECK           ');
console.log('======================================================\n');

console.log('📁 Configuration check:');
console.log(' - Supabase URL:', supabaseUrl || '❌ NOT SET');
console.log(' - Anon Key:', supabaseAnonKey ? '✅ Configured' : '❌ NOT SET');
console.log(' - Service Role Key:', supabaseServiceKey ? '✅ Configured' : '❌ NOT SET');

if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceKey) {
  console.error('\n❌ Error: Missing credentials in .env file.');
  process.exit(1);
}

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

const supabaseAnon = createClient(supabaseUrl, supabaseAnonKey);

async function runDiagnostics() {
  const results = {
    connection: false,
    authUsersCount: 0,
    profilesCount: 0,
    tables: {},
    rpcs: {},
    authLogin: false
  };

  // 1. Connection check
  try {
    const res = await fetch(`${supabaseUrl}/rest/v1/`, {
      headers: {
        'apikey': supabaseAnonKey,
        'Authorization': `Bearer ${supabaseAnonKey}`
      }
    });
    if (res.ok || res.status === 200 || res.status === 404 || res.status === 401) {
      results.connection = true;
    }
  } catch (err) {
    results.connection = false;
  }

  // 2. Auth & Users Check
  try {
    const { data: usersData, error: authError } = await supabaseAdmin.auth.admin.listUsers();
    if (!authError && usersData) {
      results.authUsersCount = usersData.users.length;
    }
  } catch (err) {
    console.error('Auth check error:', err.message);
  }

  // 3. User Authentication Test
  try {
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@vkit.local';
    const adminPassword = process.env.ADMIN_PASSWORD || 'Krrish@@1999';
    const { data: authSession, error: signInError } = await supabaseAnon.auth.signInWithPassword({
      email: adminEmail,
      password: adminPassword
    });

    if (signInError) {
      results.authLogin = { status: 'FAILED', error: signInError.message };
    } else if (authSession?.user) {
      results.authLogin = { status: 'SUCCESS', user: authSession.user.email, role: authSession.user.user_metadata?.role };
    }
  } catch (err) {
    results.authLogin = { status: 'ERROR', error: err.message };
  }

  // 4. Table Checks
  const tablesToTest = ['profiles', 'work_sessions'];
  for (const table of tablesToTest) {
    try {
      const { data, error, count } = await supabaseAdmin.from(table).select('*', { count: 'exact', head: true });
      if (error) {
        results.tables[table] = { status: 'ERROR', message: error.message, code: error.code };
      } else {
        results.tables[table] = { status: 'OK', count: count ?? 0 };
      }
    } catch (err) {
      results.tables[table] = { status: 'FAILED', message: err.message };
    }
  }

  // 5. RPC Function Checks
  const rpcsToTest = [
    { name: 'get_my_role', params: {} },
    { name: 'get_expected_next_form', params: {} },
    { name: 'get_admin_daily_summary', params: { p_date: '2026-08-24' } }
  ];

  for (const rpcObj of rpcsToTest) {
    try {
      const { data, error } = await supabaseAdmin.rpc(rpcObj.name, rpcObj.params);
      if (error) {
        results.rpcs[rpcObj.name] = { status: 'ERROR', message: error.message, code: error.code };
      } else {
        results.rpcs[rpcObj.name] = { status: 'OK', sample: data };
      }
    } catch (err) {
      results.rpcs[rpcObj.name] = { status: 'FAILED', message: err.message };
    }
  }

  // Display Summary Report
  console.log('\n📊 STATUS REPORT:');
  console.log(` 🌐 REST Endpoint Reachability: ${results.connection ? '✅ ONLINE' : '❌ UNREACHABLE'}`);
  console.log(` 👥 Supabase Auth Users Count: ${results.authUsersCount}`);
  
  if (results.authLogin.status === 'SUCCESS') {
    console.log(` 🔑 Auth Sign-in Test       : ✅ SUCCESS (Logged in as ${results.authLogin.user})`);
  } else {
    console.log(` 🔑 Auth Sign-in Test       : ⚠️ ${results.authLogin.status} - ${results.authLogin.error}`);
  }

  console.log('\n🗄️ Database Tables Status:');
  for (const [tbl, info] of Object.entries(results.tables)) {
    if (info.status === 'OK') {
      console.log(`   - ${tbl.padEnd(20)}: ✅ EXISTS (${info.count} rows)`);
    } else {
      console.log(`   - ${tbl.padEnd(20)}: ⚠️ ${info.status} - ${info.message}`);
    }
  }

  console.log('\n⚡ RPC Functions Status:');
  for (const [rpcName, info] of Object.entries(results.rpcs)) {
    if (info.status === 'OK') {
      console.log(`   - ${rpcName.padEnd(30)}: ✅ WORKING`);
    } else {
      console.log(`   - ${rpcName.padEnd(30)}: ⚠️ ${info.status} - ${info.message}`);
    }
  }

  console.log('\n======================================================');
  if (results.connection && results.authLogin.status === 'SUCCESS' && results.tables['profiles']?.status === 'OK') {
    console.log(' 🎉 RESULT: Supabase is FULLY OPERATIONAL and working fine!');
  } else {
    console.log(' ⚠️ RESULT: Supabase is online but check details above.');
  }
  console.log('======================================================\n');
}

runDiagnostics();
