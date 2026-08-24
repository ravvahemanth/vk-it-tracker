/**
 * Diagnostic script to:
 * 1. Check auth.identities schema
 * 2. Inspect a broken vs working user's identity record
 * 3. Test the exact Supabase sign-in error
 * 4. Check the RLS delete policy for profiles
 */
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const serviceClient = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function diagnose() {
  console.log('\n=== SUPABASE SCHEMA DIAGNOSTICS ===\n');

  // 1. Check auth.identities columns
  const { data: cols, error: colsErr } = await serviceClient.rpc('admin_create_employee', {
    p_full_name: 'Diag Test User',
    p_username: 'diagtest123',
    p_password: 'DiagTest@123',
    p_is_active: true
  });
  
  // Don't need to create, just check existing employees
  console.log('Checking identities for an admin-created employee...');
  
  // Get a known working employee (original production ones created via Supabase dashboard)
  const { data: adminUser } = await serviceClient.auth.admin.listUsers();
  console.log(`Total users in auth.users: ${adminUser?.users?.length}`);
  
  // Find a user that works (admin or original employee) vs one that's broken
  const allUsers = adminUser?.users || [];
  console.log('\nUsers in system:');
  for (const u of allUsers.slice(0, 5)) {
    console.log(`  - ${u.email} | confirmed: ${u.email_confirmed_at ? 'yes' : 'NO'} | identities: ${u.identities?.length || 0}`);
    if (u.identities?.length > 0) {
      const ident = u.identities[0];
      console.log(`    Identity: provider=${ident.provider}, provider_id=${ident.provider_id?.substring(0,20)}`);
      console.log(`    Identity data keys: ${Object.keys(ident.identity_data || {}).join(', ')}`);
    } else {
      console.log('    NO IDENTITIES — THIS IS THE BUG!');
    }
  }

  // 2. Check the actual identities table schema using information_schema via RPC
  console.log('\n\n=== RLS POLICY CHECK ===');
  
  // Test if admin can delete a profile (create a dummy one first)
  const testId = '00000000-0000-0000-0000-999999999999';
  
  // First try direct service role delete to see if it's a DB issue or RLS issue
  const { data: profiles } = await serviceClient.from('profiles').select('*').eq('role', 'employee').limit(1);
  if (profiles?.[0]) {
    const testProfId = profiles[0].id;
    console.log(`Testing if service client can query profiles: found id=${testProfId}`);
    
    // Check current RLS policies via pg_policies
    const { data: policies, error: polErr } = await serviceClient.rpc('exec_sql', {
      query: `SELECT tablename, policyname, cmd, qual FROM pg_policies WHERE tablename = 'profiles' ORDER BY cmd`
    });
    if (polErr) {
      console.log('Cannot query pg_policies via RPC (expected)');
    }
  }

  // 3. Test the exact "Database error querying schema" trigger
  // Create a user directly using service role admin API (Supabase's official way)
  console.log('\n\n=== TESTING SUPABASE ADMIN API vs SQL INSERT ===');
  
  try {
    // This is the PROPER way to create users in Supabase
    const { data: createdUser, error: createErr } = await serviceClient.auth.admin.createUser({
      email: 'diagtest456@vkit.local',
      password: 'DiagTest@456',
      email_confirm: true,
      user_metadata: {
        full_name: 'Diag Test 456',
        username: 'diagtest456',
        role: 'employee'
      }
    });
    
    if (createErr) {
      console.log('Admin API create failed:', createErr.message);
    } else {
      console.log('Admin API create SUCCESS:', createdUser.user.id);
      console.log('Identities count:', createdUser.user.identities?.length);
      if (createdUser.user.identities?.length > 0) {
        console.log('First identity:', JSON.stringify(createdUser.user.identities[0], null, 2));
      }
      
      // Try signing in
      const testClient = createClient(supabaseUrl, process.env.VITE_SUPABASE_ANON_KEY);
      const { data: signInData, error: signInErr } = await testClient.auth.signInWithPassword({
        email: 'diagtest456@vkit.local',
        password: 'DiagTest@456'
      });
      
      if (signInErr) {
        console.log('Sign in with Admin API user FAILED:', signInErr.message);
      } else {
        console.log('Sign in with Admin API user SUCCESS!', signInData.user.id);
        await testClient.auth.signOut();
      }
      
      // Clean up
      await serviceClient.auth.admin.deleteUser(createdUser.user.id);
      console.log('Diag user cleaned up');
    }
  } catch (e) {
    console.log('Exception:', e.message);
  }
}

diagnose().catch(console.error);
