/**
 * Deep diagnostic: examine EXACTLY what Supabase Admin API sets in auth.identities
 * vs what our SQL function sets - using service role to inspect
 */
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;
const projectRef = 'qzcggsqfsocniolsdaph';

const serviceClient = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function deepDiagnose() {
  console.log('\n=== DEEP SCHEMA ANALYSIS ===\n');

  // Check the auth.identities schema via information_schema
  // Use the REST API to run SQL via the Management API
  const response = await fetch(`https://${projectRef}.supabase.co/rest/v1/rpc/exec_sql_diagnose`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': supabaseServiceKey,
      'Authorization': `Bearer ${supabaseServiceKey}`
    },
    body: JSON.stringify({})
  });
  console.log('Custom RPC response status:', response.status);

  // Create an API-created user and compare with SQL-created user structure
  console.log('\n1. Creating user via Admin API...');
  const { data: apiUser, error: apiErr } = await serviceClient.auth.admin.createUser({
    email: 'apitest001@vkit.local',
    password: 'ApiTest@001!',
    email_confirm: true,
    user_metadata: { full_name: 'API Test 001', username: 'apitest001', role: 'employee' }
  });

  if (apiErr) {
    console.error('API create failed:', apiErr);
    return;
  }

  console.log('API User created:', apiUser.user.id);
  console.log('API User identities:', JSON.stringify(apiUser.user.identities, null, 2));

  // Now create via SQL function (admin client login required)
  const adminClient = createClient(supabaseUrl, supabaseAnonKey);
  const { error: adminLoginErr } = await adminClient.auth.signInWithPassword({
    email: 'admin@vkit.local', password: 'Krrish@@1999'
  });

  if (!adminLoginErr) {
    console.log('\n2. Creating user via admin SQL RPC...');
    const { data: sqlUser, error: sqlErr } = await adminClient.rpc('admin_create_employee', {
      p_full_name: 'SQL Test 002',
      p_username: 'sqltest002',
      p_password: 'SqlTest@002!',
      p_is_active: true
    });

    if (sqlErr) {
      console.error('SQL create failed:', sqlErr);
    } else if (sqlUser?.success) {
      console.log('SQL User created:', sqlUser.profile.id);
      
      // Inspect the SQL user via admin API
      const { data: sqlUserDetails } = await serviceClient.auth.admin.getUserById(sqlUser.profile.id);
      console.log('SQL User from Admin API:', JSON.stringify(sqlUserDetails?.user?.identities, null, 2));

      // Compare
      console.log('\n=== COMPARISON ===');
      const apiIdent = apiUser.user.identities[0];
      const sqlIdent = sqlUserDetails?.user?.identities?.[0];
      
      if (sqlIdent) {
        console.log('API identity keys:', Object.keys(apiIdent).join(', '));
        console.log('SQL identity keys:', Object.keys(sqlIdent).join(', '));
        
        const missing = Object.keys(apiIdent).filter(k => !(k in sqlIdent));
        console.log('MISSING from SQL:', missing);
      } else {
        console.log('SQL user has NO identities! That is the bug.');
      }

      // Test sign-in for SQL user
      const testClient = createClient(supabaseUrl, supabaseAnonKey);
      const { error: signInErr } = await testClient.auth.signInWithPassword({
        email: 'sqltest002@vkit.local',
        password: 'SqlTest@002!'
      });
      if (signInErr) {
        console.log('\nSQL user sign-in ERROR:', signInErr.message);
      } else {
        console.log('\nSQL user sign-in SUCCESS!');
        await testClient.auth.signOut();
      }

      // Clean up SQL user
      await serviceClient.auth.admin.deleteUser(sqlUser.profile.id);
      await serviceClient.from('profiles').delete().eq('id', sqlUser.profile.id);
    }

    await adminClient.auth.signOut();
  }

  // Clean up API user
  await serviceClient.auth.admin.deleteUser(apiUser.user.id);
  console.log('\nDiag users cleaned up');
}

deepDiagnose().catch(console.error);
