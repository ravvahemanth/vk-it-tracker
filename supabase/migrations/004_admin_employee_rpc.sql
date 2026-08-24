-- ============================================================
-- VK IT Solutions — Employee Work Session Tracker
-- Migration 004: Admin Employee Management RPCs
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- FUNCTION: admin_create_employee
-- Allows admin to create new employee Auth user + Profile
-- ============================================================
CREATE OR REPLACE FUNCTION public.admin_create_employee(
  p_full_name TEXT,
  p_username TEXT,
  p_password TEXT,
  p_is_active BOOLEAN DEFAULT true
)
RETURNS JSON AS $$
DECLARE
  v_caller_role TEXT;
  v_new_id UUID;
  v_clean_username TEXT;
  v_email TEXT;
  v_new_profile public.profiles%ROWTYPE;
BEGIN
  -- 1. Security Check: Only admin can call this
  SELECT role INTO v_caller_role FROM public.profiles WHERE id = auth.uid();
  IF v_caller_role IS NULL OR v_caller_role != 'admin' THEN
    RETURN json_build_object('success', false, 'error', 'Unauthorized. Only administrators can create employee accounts.');
  END IF;

  -- 2. Input Validation
  IF p_full_name IS NULL OR length(trim(p_full_name)) = 0 THEN
    RETURN json_build_object('success', false, 'error', 'Full name is required.');
  END IF;

  IF p_username IS NULL OR length(trim(p_username)) = 0 THEN
    RETURN json_build_object('success', false, 'error', 'Username is required.');
  END IF;

  v_clean_username := regexp_replace(lower(trim(p_username)), '\s+', '', 'g');

  IF length(p_password) < 8 THEN
    RETURN json_build_object('success', false, 'error', 'Password must be at least 8 characters long.');
  END IF;

  -- 3. Check Username Uniqueness
  IF EXISTS (SELECT 1 FROM public.profiles WHERE lower(username) = v_clean_username) THEN
    RETURN json_build_object('success', false, 'error', format('Username "%s" is already taken.', v_clean_username));
  END IF;

  v_email := v_clean_username || '@vkit.local';
  v_new_id := uuid_generate_v4();

  -- 4. Create User in auth.users
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

  -- 5. Create User Identity in auth.identities
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

  -- 6. Upsert Profile
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
    RETURN json_build_object('success', false, 'error', format('Username or email already exists.', v_clean_username));
  WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'error', format('Failed to create user: %s', SQLERRM));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- FUNCTION: admin_update_employee
-- Allows admin to edit employee profile (Name, Username, Status)
-- ============================================================
CREATE OR REPLACE FUNCTION public.admin_update_employee(
  p_employee_id UUID,
  p_full_name TEXT,
  p_username TEXT,
  p_is_active BOOLEAN
)
RETURNS JSON AS $$
DECLARE
  v_caller_role TEXT;
  v_clean_username TEXT;
  v_email TEXT;
  v_updated_profile public.profiles%ROWTYPE;
BEGIN
  SELECT role INTO v_caller_role FROM public.profiles WHERE id = auth.uid();
  IF v_caller_role IS NULL OR v_caller_role != 'admin' THEN
    RETURN json_build_object('success', false, 'error', 'Unauthorized. Only administrators can update employee accounts.');
  END IF;

  v_clean_username := lower(trim(p_username));

  IF EXISTS (SELECT 1 FROM public.profiles WHERE lower(username) = v_clean_username AND id != p_employee_id) THEN
    RETURN json_build_object('success', false, 'error', format('Username "%s" is already taken by another account.', v_clean_username));
  END IF;

  v_email := v_clean_username || '@vkit.local';

  UPDATE public.profiles SET
    full_name = trim(p_full_name),
    username = v_clean_username,
    is_active = p_is_active,
    updated_at = NOW()
  WHERE id = p_employee_id
  RETURNING * INTO v_updated_profile;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Employee profile not found.');
  END IF;

  UPDATE auth.users SET
    email = v_email,
    raw_user_meta_data = json_build_object('full_name', trim(p_full_name), 'username', v_clean_username, 'role', 'employee'),
    updated_at = NOW()
  WHERE id = p_employee_id;

  RETURN json_build_object(
    'success', true,
    'message', format('Employee %s updated successfully.', trim(p_full_name)),
    'profile', row_to_json(v_updated_profile)
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'error', format('Failed to update employee: %s', SQLERRM));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- FUNCTION: admin_reset_employee_password
-- Allows admin to update password for an employee
-- ============================================================
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

  UPDATE auth.users SET
    encrypted_password = crypt(p_new_password, gen_salt('bf')),
    updated_at = NOW()
  WHERE id = p_employee_id;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Employee account not found.');
  END IF;

  RETURN json_build_object('success', true, 'message', 'Password updated successfully.');
EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'error', format('Failed to reset password: %s', SQLERRM));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- FUNCTION: admin_toggle_employee_status
-- Allows admin to activate or deactivate an employee
-- ============================================================
CREATE OR REPLACE FUNCTION public.admin_toggle_employee_status(
  p_employee_id UUID,
  p_is_active BOOLEAN
)
RETURNS JSON AS $$
DECLARE
  v_caller_role TEXT;
  v_updated_profile public.profiles%ROWTYPE;
BEGIN
  SELECT role INTO v_caller_role FROM public.profiles WHERE id = auth.uid();
  IF v_caller_role IS NULL OR v_caller_role != 'admin' THEN
    RETURN json_build_object('success', false, 'error', 'Unauthorized.');
  END IF;

  UPDATE public.profiles SET
    is_active = p_is_active,
    updated_at = NOW()
  WHERE id = p_employee_id
  RETURNING * INTO v_updated_profile;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Employee not found.');
  END IF;

  RETURN json_build_object(
    'success', true,
    'message', format('Employee %s.', CASE WHEN p_is_active THEN 'activated' ELSE 'deactivated' END),
    'profile', row_to_json(v_updated_profile)
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'error', format('Failed to toggle status: %s', SQLERRM));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- FUNCTION: admin_delete_employee
-- Allows admin to permanently delete an employee profile + auth user
-- ============================================================
CREATE OR REPLACE FUNCTION public.admin_delete_employee(
  p_employee_id UUID
)
RETURNS JSON AS $$
DECLARE
  v_caller_role TEXT;
  v_username TEXT;
BEGIN
  -- Security check: Only admin can delete employees
  SELECT role INTO v_caller_role FROM public.profiles WHERE id = auth.uid();
  IF v_caller_role IS NULL OR v_caller_role != 'admin' THEN
    RETURN json_build_object('success', false, 'error', 'Unauthorized. Only administrators can delete employee accounts.');
  END IF;

  SELECT username INTO v_username FROM public.profiles WHERE id = p_employee_id;
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Employee profile not found.');
  END IF;

  -- Delete work_sessions to prevent orphaned records
  DELETE FROM public.work_sessions WHERE employee_id = p_employee_id;

  -- Delete profile
  DELETE FROM public.profiles WHERE id = p_employee_id;

  -- Delete auth user & identities
  DELETE FROM auth.identities WHERE user_id = p_employee_id;
  DELETE FROM auth.users WHERE id = p_employee_id;

  RETURN json_build_object(
    'success', true,
    'message', format('Employee account %s deleted successfully.', v_username)
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'error', format('Failed to delete employee: %s', SQLERRM));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- FUNCTION: admin_purge_test_accounts
-- Allows purging legacy corrupted test user accounts
-- ============================================================
CREATE OR REPLACE FUNCTION public.admin_purge_test_accounts()
RETURNS JSON AS $$
DECLARE
  v_count INT := 0;
BEGIN
  -- Delete identities for test accounts
  DELETE FROM auth.identities 
  WHERE email LIKE '%test%' 
     OR identity_data->>'email' LIKE '%test%';

  -- Delete profiles for test accounts
  DELETE FROM public.profiles 
  WHERE username LIKE '%test%' 
     OR lower(full_name) LIKE '%test%';

  -- Delete auth users for test accounts
  DELETE FROM auth.users 
  WHERE email LIKE '%test%';

  GET DIAGNOSTICS v_count = ROW_COUNT;

  RETURN json_build_object('success', true, 'deleted_count', v_count);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

