-- 005_fix_employee_creation.sql
-- Fixes admin_create_employee function:
-- 1. Uses gen_salt('bf', 10) for stronger bcrypt
-- 2. Uses uuid_generate_v4() for identity PK (not v_new_id which conflicts with user_id)
-- 3. Uses v_new_id::text for provider_id (GoTrue requirement)
-- 4. Strips spaces from usernames
-- 5. Fixes duplicate email check before insert to avoid partial state

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
  -- Security check: Only admin can create employees
  SELECT role INTO v_caller_role FROM public.profiles WHERE id = auth.uid();
  IF v_caller_role IS NULL OR v_caller_role != 'admin' THEN
    RETURN json_build_object('success', false, 'error', 'Unauthorized. Only administrators can create employee accounts.');
  END IF;

  -- Validate inputs
  IF trim(p_full_name) = '' OR p_full_name IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Full name is required.');
  END IF;
  IF trim(p_username) = '' OR p_username IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Username is required.');
  END IF;

  -- Sanitize username: lowercase + strip all spaces
  v_clean_username := regexp_replace(lower(trim(p_username)), '\s+', '', 'g');

  IF length(p_password) < 8 THEN
    RETURN json_build_object('success', false, 'error', 'Password must be at least 8 characters long.');
  END IF;

  -- Check duplicate username in profiles
  IF EXISTS (SELECT 1 FROM public.profiles WHERE username = v_clean_username) THEN
    RETURN json_build_object('success', false, 'error', format('Username "%s" is already taken.', v_clean_username));
  END IF;

  v_email := v_clean_username || '@vkit.local';
  v_new_id := uuid_generate_v4();

  -- Check duplicate in auth.users
  IF EXISTS (SELECT 1 FROM auth.users WHERE email = v_email) THEN
    RETURN json_build_object('success', false, 'error', 'Username or email already exists.');
  END IF;

  -- Create auth user
  INSERT INTO auth.users (
    id,
    instance_id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at
  ) VALUES (
    v_new_id,
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    v_email,
    crypt(p_password, gen_salt('bf', 10)),
    NOW(),
    '{"provider":"email","providers":["email"]}',
    json_build_object('full_name', trim(p_full_name), 'username', v_clean_username, 'role', 'employee'),
    NOW(),
    NOW()
  );

  -- Create auth identity (FIXED: unique PK, provider_id = user UUID string)
  INSERT INTO auth.identities (
    id,
    user_id,
    identity_data,
    provider,
    provider_id,
    last_sign_in_at,
    created_at,
    updated_at
  ) VALUES (
    uuid_generate_v4(),
    v_new_id,
    json_build_object('sub', v_new_id::text, 'email', v_email, 'email_verified', true),
    'email',
    v_new_id::text,
    NOW(),
    NOW(),
    NOW()
  );

  -- Upsert profile
  INSERT INTO public.profiles (
    id,
    full_name,
    username,
    role,
    is_active,
    created_at,
    updated_at
  ) VALUES (
    v_new_id,
    trim(p_full_name),
    v_clean_username,
    'employee',
    COALESCE(p_is_active, true),
    NOW(),
    NOW()
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

-- Also fix admin_reset_employee_password to properly update bcrypt hash
CREATE OR REPLACE FUNCTION public.admin_reset_employee_password(
  p_employee_id UUID,
  p_new_password TEXT
)
RETURNS JSON AS $$
DECLARE
  v_caller_role TEXT;
BEGIN
  SELECT role INTO v_caller_role FROM public.profiles WHERE id = auth.uid();
  IF v_caller_role IS NULL OR v_caller_role != 'admin' THEN
    RETURN json_build_object('success', false, 'error', 'Unauthorized.');
  END IF;

  IF length(p_new_password) < 8 THEN
    RETURN json_build_object('success', false, 'error', 'Password must be at least 8 characters long.');
  END IF;

  UPDATE auth.users
  SET
    encrypted_password = crypt(p_new_password, gen_salt('bf', 10)),
    updated_at = NOW()
  WHERE id = p_employee_id;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Employee auth user not found.');
  END IF;

  RETURN json_build_object('success', true, 'message', 'Password updated successfully.');
EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'error', format('Failed to reset password: %s', SQLERRM));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
