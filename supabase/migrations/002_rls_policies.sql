-- ============================================================
-- VK IT Solutions — Employee Work Session Tracker
-- Migration 002: Row Level Security Policies
-- ============================================================

-- ============================================================
-- ENABLE RLS
-- ============================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.work_sessions ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- HELPER FUNCTION: Get current user role
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS TEXT AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ============================================================
-- PROFILES RLS POLICIES
-- ============================================================

-- Employees can read their own profile
CREATE POLICY "employees_read_own_profile"
  ON public.profiles FOR SELECT
  USING (id = auth.uid());

-- Admin can read all profiles
CREATE POLICY "admin_read_all_profiles"
  ON public.profiles FOR SELECT
  USING (public.get_my_role() = 'admin');

-- Allow profile to be created via trigger (service role)
CREATE POLICY "allow_profile_insert_service"
  ON public.profiles FOR INSERT
  WITH CHECK (id = auth.uid() OR public.get_my_role() = 'admin');

-- Employees can update their own non-sensitive fields
CREATE POLICY "employees_update_own_profile"
  ON public.profiles FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid() AND role = 'employee');

-- Admin can update all profiles
CREATE POLICY "admin_update_all_profiles"
  ON public.profiles FOR UPDATE
  USING (public.get_my_role() = 'admin');

-- Admin can delete employee profiles
CREATE POLICY "admin_delete_profiles"
  ON public.profiles FOR DELETE
  USING (public.get_my_role() = 'admin');

-- ============================================================
-- WORK SESSIONS RLS POLICIES
-- ============================================================

-- Employees can read only their own sessions
CREATE POLICY "employees_read_own_sessions"
  ON public.work_sessions FOR SELECT
  USING (employee_id = auth.uid() OR public.get_my_role() = 'admin');

-- Employees can create sessions for themselves only
CREATE POLICY "employees_insert_own_sessions"
  ON public.work_sessions FOR INSERT
  WITH CHECK (employee_id = auth.uid() AND public.get_my_role() = 'employee');

-- Employees can update only their own ACTIVE sessions
-- (completed sessions are immutable for employees)
CREATE POLICY "employees_update_own_active_sessions"
  ON public.work_sessions FOR UPDATE
  USING (
    (employee_id = auth.uid() AND status = 'working')
    OR public.get_my_role() = 'admin'
  )
  WITH CHECK (
    (employee_id = auth.uid())
    OR public.get_my_role() = 'admin'
  );

-- Admin can delete sessions when removing an employee account
CREATE POLICY "admin_delete_sessions"
  ON public.work_sessions FOR DELETE
  USING (public.get_my_role() = 'admin');
