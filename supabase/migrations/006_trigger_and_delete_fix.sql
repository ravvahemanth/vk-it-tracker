-- 006_handle_new_user_trigger.sql
-- Adds a trigger that auto-creates a profiles row when a new auth user is created.
-- This works with users created via either:
--   1. Supabase Admin API (serviceClient.auth.admin.createUser)
--   2. SQL direct insert (legacy)
-- 
-- Also adds a proper admin_delete_employee function that uses cascading delete
-- And fixes the admin RLS policy to allow admins to delete profiles

-- ============================================================
-- TRIGGER: on_auth_user_created
-- Auto-creates a profiles row when a new auth.users row is inserted
-- ============================================================

-- Function called by trigger
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Only create profile if it doesn't already exist (avoids conflicts)
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = NEW.id) THEN
    INSERT INTO public.profiles (id, full_name, username, role, is_active, created_at, updated_at)
    VALUES (
      NEW.id,
      COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
      COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1)),
      COALESCE(NEW.raw_user_meta_data->>'role', 'employee'),
      true,
      NOW(),
      NOW()
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Create trigger (fires AFTER INSERT on auth.users)
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- Fix admin_delete_employee to also handle auth deletion gracefully
-- The auth.users deletion should happen via GoTrue Admin API from frontend
-- This function just cleans up work_sessions and profiles
-- ============================================================

CREATE OR REPLACE FUNCTION public.admin_delete_employee(
  p_employee_id UUID
)
RETURNS JSON AS $$
DECLARE
  v_caller_role TEXT;
  v_deleted_sessions INTEGER;
BEGIN
  -- Security: Only admin can delete employees
  SELECT role INTO v_caller_role FROM public.profiles WHERE id = auth.uid();
  IF v_caller_role IS NULL OR v_caller_role != 'admin' THEN
    RETURN json_build_object('success', false, 'error', 'Unauthorized. Only administrators can delete employee accounts.');
  END IF;

  -- Cannot delete yourself
  IF p_employee_id = auth.uid() THEN
    RETURN json_build_object('success', false, 'error', 'You cannot delete your own account.');
  END IF;

  -- Check target is an employee (not admin)
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_employee_id AND role = 'employee') THEN
    RETURN json_build_object('success', false, 'error', 'Employee not found or cannot delete admin accounts.');
  END IF;

  -- Delete work sessions
  DELETE FROM public.work_sessions WHERE employee_id = p_employee_id;
  GET DIAGNOSTICS v_deleted_sessions = ROW_COUNT;

  -- Delete profile
  DELETE FROM public.profiles WHERE id = p_employee_id;

  RETURN json_build_object(
    'success', true,
    'message', 'Employee profile and sessions deleted successfully.',
    'sessions_deleted', v_deleted_sessions,
    'note', 'Auth user deletion must be completed separately via Admin API.'
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'error', format('Failed to delete employee: %s', SQLERRM));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- Fix RLS policies for profiles table
-- Ensure admin can UPDATE and DELETE employee profiles
-- ============================================================

-- Drop existing restrictive policies on profiles
DROP POLICY IF EXISTS "admin_can_read_all_profiles" ON public.profiles;
DROP POLICY IF EXISTS "admin_can_update_profiles" ON public.profiles;
DROP POLICY IF EXISTS "admin_can_delete_profiles" ON public.profiles;
DROP POLICY IF EXISTS "users_read_own_profile" ON public.profiles;
DROP POLICY IF EXISTS "users_update_own_profile" ON public.profiles;
DROP POLICY IF EXISTS "service_role_all_profiles" ON public.profiles;

-- Service role can do anything (bypasses RLS anyway but good to be explicit)
-- Note: service_role already bypasses RLS in Supabase by default

-- Admin user can read all profiles
CREATE POLICY "admin_can_read_all_profiles"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() = id  -- own profile
    OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'  -- admin reads all
  );

-- Admin can update any profile
CREATE POLICY "admin_can_update_profiles"
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = id  -- own profile
    OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
  );

-- Admin can delete employee profiles (not own profile)
CREATE POLICY "admin_can_delete_profiles"
  ON public.profiles
  FOR DELETE
  TO authenticated
  USING (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
    AND id != auth.uid()  -- Cannot delete own profile
  );

-- Allow profile inserts from trigger (handle_new_user is SECURITY DEFINER so this is automatic)
-- But also allow direct inserts for the SQL creation path
CREATE POLICY "profiles_insert_policy"
  ON public.profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = id  -- own profile on signup
    OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'  -- admin creates
  );

-- Grant execute on new functions
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.admin_delete_employee(UUID) TO authenticated;

-- Done
SELECT 'Migration 006 applied successfully: trigger + delete fix + RLS policies' AS result;
