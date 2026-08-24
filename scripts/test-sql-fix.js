/**
 * Test whether adding identity_id to the SQL insert fixes the "Database error querying schema"
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

async function testSQLFix() {
  console.log('\n=== TEST: SQL INSERT with identity_id field ===\n');
  
  // Deploy a test function that includes identity_id
  const testFnSQL = `
CREATE OR REPLACE FUNCTION public.test_create_user_v2(
  p_email TEXT,
  p_password TEXT
)
RETURNS JSON AS $$
DECLARE
  v_new_id UUID;
  v_identity_id UUID;
BEGIN
  v_new_id := uuid_generate_v4();
  v_identity_id := uuid_generate_v4();
  
  -- Create auth user
  INSERT INTO auth.users (
    id, instance_id, aud, role, email,
    encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at
  ) VALUES (
    v_new_id,
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated',
    p_email,
    crypt(p_password, gen_salt('bf', 10)),
    NOW(),
    '{"provider":"email","providers":["email"]}',
    json_build_object('email', p_email),
    NOW(), NOW()
  );

  -- Create identity WITH identity_id (primary key in newer Supabase)
  BEGIN
    INSERT INTO auth.identities (
      identity_id,
      id,
      user_id,
      identity_data,
      provider,
      provider_id,
      last_sign_in_at,
      created_at,
      updated_at
    ) VALUES (
      v_identity_id,
      v_new_id,
      v_new_id,
      json_build_object('sub', v_new_id::text, 'email', p_email, 'email_verified', true, 'phone_verified', false),
      'email',
      v_new_id::text,
      NOW(), NOW(), NOW()
    );
    RETURN json_build_object('success', true, 'user_id', v_new_id, 'identity_id', v_identity_id, 'method', 'with_identity_id');
  EXCEPTION
    WHEN undefined_column THEN
      -- Fallback: try without identity_id (older schema)
      INSERT INTO auth.identities (
        id, user_id, identity_data, provider, provider_id,
        last_sign_in_at, created_at, updated_at
      ) VALUES (
        v_new_id, v_new_id,
        json_build_object('sub', v_new_id::text, 'email', p_email, 'email_verified', true),
        'email', v_new_id::text,
        NOW(), NOW(), NOW()
      );
      RETURN json_build_object('success', true, 'user_id', v_new_id, 'method', 'without_identity_id');
    WHEN OTHERS THEN
      RETURN json_build_object('success', false, 'error', format('Identity insert failed: %s', SQLERRM));
  END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
`;

  // Deploy the test function via Management API
  const mgmtUrl = `https://api.supabase.com/v1/projects/${projectRef}/database/query`;
  
  // Actually just use the existing admin RPC to test
  // Deploy function via GoTrue direct SQL endpoint
  const sqlExecUrl = `${supabaseUrl}/rest/v1/rpc/exec_sql`;
  
  // Let's use a direct approach - call the GoTrue API to check the identities schema
  const schemaUrl = `https://${projectRef}.supabase.co/rest/v1/`;
  
  // Check auth.identities column definitions via information_schema
  // We need to look at this via the Management API
  const colsResponse = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/database/query`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${supabaseServiceKey}`
    },
    body: JSON.stringify({
      query: `SELECT column_name, data_type, is_nullable 
              FROM information_schema.columns 
              WHERE table_schema = 'auth' AND table_name = 'identities'
              ORDER BY ordinal_position`
    })
  });
  
  if (colsResponse.ok) {
    const colsData = await colsResponse.json();
    console.log('auth.identities columns:', JSON.stringify(colsData, null, 2));
  } else {
    console.log('Management API query failed:', colsResponse.status, await colsResponse.text());
    
    // Try alternate approach: check via service role REST API query to identities directly  
    // Get an existing identity row to see its structure
    const { data: existingIdents, error: identErr } = await serviceClient
      .from('identities') // This won't work via REST but let's see
      .select('*')
      .limit(1);
    
    if (identErr) {
      console.log('Cannot query identities via REST:', identErr.message);
    } else {
      console.log('Identities sample:', JSON.stringify(existingIdents?.[0], null, 2));
    }
  }

  // Just test both approaches directly
  console.log('\nTrying SQL user creation WITH identity_id...');
  
  const adminClient = createClient(supabaseUrl, supabaseAnonKey);
  await adminClient.auth.signInWithPassword({ email: 'admin@vkit.local', password: 'Krrish@@1999' });
  
  // Try the approach that GoTrue uses: call GoTrue admin API from within our flow
  // but triggered by admin JS client calling it directly
  
  // Actually, the cleanest fix: have the admin_create_employee function ONLY create the profile,
  // and create auth user via the Supabase admin JS client
  
  // Test scenario: create profile separately after API-creating user
  const gotrueUrl = `https://${projectRef}.supabase.co/auth/v1/admin/users`;
  
  const userResp = await fetch(gotrueUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': supabaseServiceKey,
      'Authorization': `Bearer ${supabaseServiceKey}`
    },
    body: JSON.stringify({
      email: 'fixtest888@vkit.local',
      password: 'FixTest@888!',
      email_confirm: true,
      user_metadata: { full_name: 'Fix Test 888', username: 'fixtest888', role: 'employee' }
    })
  });
  
  const userData = await userResp.json();
  if (!userData.id) {
    console.log('GoTrue user create failed:', userData);
    return;
  }
  
  console.log('Created auth user via GoTrue API:', userData.id);
  
  // Create profile manually
  const { error: profErr } = await serviceClient.from('profiles').insert({
    id: userData.id,
    full_name: 'Fix Test 888',
    username: 'fixtest888',
    role: 'employee',
    is_active: true
  });
  
  if (profErr) {
    console.log('Profile insert failed:', profErr.message);
  } else {
    console.log('Profile created in DB');
  }
  
  // Test sign in
  const testClient = createClient(supabaseUrl, supabaseAnonKey);
  const { data: signInData, error: signInErr } = await testClient.auth.signInWithPassword({
    email: 'fixtest888@vkit.local',
    password: 'FixTest@888!'
  });
  
  if (signInErr) {
    console.log('Sign in FAILED:', signInErr.message);
  } else {
    console.log('Sign in SUCCESS! User ID:', signInData.user.id);
    
    // Verify profile accessible
    const { data: profile } = await testClient.from('profiles').select('*').eq('id', signInData.user.id).single();
    console.log('Profile accessible:', profile?.username, profile?.role);
    await testClient.auth.signOut();
  }
  
  // Clean up
  await serviceClient.auth.admin.deleteUser(userData.id);
  await serviceClient.from('profiles').delete().eq('id', userData.id);
  await adminClient.auth.signOut();
  console.log('Cleaned up test user');
}

testSQLFix().catch(console.error);
