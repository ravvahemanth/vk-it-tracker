import dotenv from 'dotenv';
dotenv.config();

// Use Supabase Management API to run SQL directly
const projectRef = 'qzcggsqfsocniolsdaph';
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// The FIXED admin_create_employee SQL function
const FIXED_SQL = `
CREATE OR REPLACE FUNCTION public.admin_create_employee(
  p_full_name TEXT,
  p_username TEXT,
  p_password TEXT,
  p_is_active BOOLEAN DEFAULT true
)
RETURNS JSON AS $$
DECLARE
  v_caller_role TEXT;
  v_clean_username TEXT;
  v_email TEXT;
  v_new_id UUID;
  v_new_profile public.profiles;
BEGIN
  SELECT role INTO v_caller_role FROM public.profiles WHERE id = auth.uid();
  IF v_caller_role IS NULL OR v_caller_role != 'admin' THEN
    RETURN json_build_object('success', false, 'error', 'Unauthorized. Only administrators can create employee accounts.');
  END IF;

  IF trim(p_full_name) = '' OR p_full_name IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Full name is required.');
  END IF;
  IF trim(p_username) = '' OR p_username IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Username is required.');
  END IF;

  v_clean_username := regexp_replace(lower(trim(p_username)), '\\s+', '', 'g');

  IF length(p_password) < 8 THEN
    RETURN json_build_object('success', false, 'error', 'Password must be at least 8 characters long.');
  END IF;

  IF EXISTS (SELECT 1 FROM public.profiles WHERE username = v_clean_username) THEN
    RETURN json_build_object('success', false, 'error', format('Username "%s" is already taken.', v_clean_username));
  END IF;

  v_email := v_clean_username || '@vkit.local';
  v_new_id := uuid_generate_v4();

  IF EXISTS (SELECT 1 FROM auth.users WHERE email = v_email) THEN
    RETURN json_build_object('success', false, 'error', 'Username or email already exists.');
  END IF;

  INSERT INTO auth.users (
    id, instance_id, aud, role, email,
    encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at
  ) VALUES (
    v_new_id,
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', v_email,
    crypt(p_password, gen_salt('bf', 10)),
    NOW(),
    '{"provider":"email","providers":["email"]}',
    json_build_object('full_name', trim(p_full_name), 'username', v_clean_username, 'role', 'employee'),
    NOW(), NOW()
  );

  INSERT INTO auth.identities (
    id, user_id, identity_data, provider, provider_id,
    last_sign_in_at, created_at, updated_at
  ) VALUES (
    uuid_generate_v4(),
    v_new_id,
    json_build_object('sub', v_new_id::text, 'email', v_email, 'email_verified', true),
    'email',
    v_new_id::text,
    NOW(), NOW(), NOW()
  );

  INSERT INTO public.profiles (
    id, full_name, username, role, is_active, created_at, updated_at
  ) VALUES (
    v_new_id, trim(p_full_name), v_clean_username, 'employee',
    COALESCE(p_is_active, true), NOW(), NOW()
  )
  ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    username = EXCLUDED.username,
    is_active = EXCLUDED.is_active,
    updated_at = NOW()
  RETURNING * INTO v_new_profile;

  RETURN json_build_object(
    'success', true,
    'message', format('Employee account for %s created successfully.', trim(p_full_name)),
    'profile', row_to_json(v_new_profile)
  );

EXCEPTION
  WHEN unique_violation THEN
    RETURN json_build_object('success', false, 'error', 'Username or email already exists.');
  WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'error', format('Failed to create user: %s', SQLERRM));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
`;

async function runSQL(sql) {
  const url = `https://api.supabase.com/v1/projects/${projectRef}/database/query`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${serviceKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ query: sql })
  });

  const body = await res.text();
  return { status: res.status, body };
}

async function main() {
  console.log('Deploying FIXED admin_create_employee SQL function to Supabase...');
  const result = await runSQL(FIXED_SQL);
  console.log('HTTP Status:', result.status);
  console.log('Response:', result.body);

  if (result.status >= 200 && result.status < 300) {
    console.log('\n✅ SQL deployed successfully!');

    // Now create test1 via the fixed function
    console.log('\nNow creating test1 employee account with the fixed function...');
    const CREATE_TEST1_SQL = `
      SELECT public.admin_create_employee_direct(
        'Test 1 Employee',
        'test1',
        'Ravva@1234',
        true
      );
    `;
    // ... not ideal, let's do it via anon client calling RPC instead
    console.log('Please run: node scripts/purge-and-create-test1.js');
  } else {
    console.error('\n❌ Failed to deploy SQL:', result.body);
  }
}

main().catch(console.error);
